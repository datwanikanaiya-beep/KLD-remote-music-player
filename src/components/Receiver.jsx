/**
 * Receiver Component
 * Written by: Kanaiya L Datwani (Proud Hindu - Sanatani)
 * 
 * Handles the WebRTC data incoming chunks and reconstructs the audio file
 * to play locally. Also beams playback state back to the controller.
 */
import React, { useState, useEffect, useRef } from 'react';
import { Peer } from 'peerjs';
import { ArrowLeft, Activity } from 'lucide-react';

export default function Receiver({ onBack }) {
  const [peerId, setPeerId] = useState('');
  const [status, setStatus] = useState('connecting');
  const [activeTrack, setActiveTrack] = useState(null);
  const [transferProgress, setTransferProgress] = useState(0);
  
  const peerRef = useRef(null);
  const connRef = useRef(null);
  const audioRef = useRef(null);
  const canvasRef = useRef(null);
  const chunksRef = useRef([]);

  // Initialize Web Audio API Visualizer
  useEffect(() => {
    let audioCtx, analyser, source;
    let animationId;
    
    const initAudioVisualizer = () => {
        if (!audioRef.current || !canvasRef.current || audioCtx) return;
        
        try {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            analyser = audioCtx.createAnalyser();
            analyser.fftSize = 64; 
            
            source = audioCtx.createMediaElementSource(audioRef.current);
            source.connect(analyser);
            analyser.connect(audioCtx.destination);
            
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');
            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);
            
            const draw = () => {
                if (!canvasRef.current) return;
                animationId = requestAnimationFrame(draw);
                
                analyser.getByteFrequencyData(dataArray);
                
                // Clear background
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                
                const barWidth = (canvas.width / bufferLength) * 2;
                let x = 0;
                
                for(let i = 0; i < bufferLength; i++) {
                    const pct = dataArray[i] / 255;
                    const barHeight = pct * canvas.height;
                    
                    const gradient = ctx.createLinearGradient(0, canvas.height, 0, canvas.height - barHeight);
                    gradient.addColorStop(0, 'rgba(168, 85, 247, 0.4)');
                    gradient.addColorStop(1, '#ec4899');
                    
                    ctx.fillStyle = gradient;
                    // Draw rounded bars from bottom up
                    ctx.beginPath();
                    ctx.roundRect(x, canvas.height - barHeight, barWidth - 4, barHeight + 4, [6, 6, 0, 0]);
                    ctx.fill();
                    
                    x += barWidth;
                }
            };
            draw();
        } catch (e) {
            console.warn('Audio visualization not supported/permitted', e);
        }
    };
    
    const handlePlay = () => {
        if (audioCtx?.state === 'suspended') audioCtx.resume();
        initAudioVisualizer();
    };

    const targetAudio = audioRef.current;
    if (targetAudio) {
       targetAudio.addEventListener('play', handlePlay);
    }
    
    return () => {
       if (animationId) cancelAnimationFrame(animationId);
       if (audioCtx) audioCtx.close();
       if (targetAudio) targetAudio.removeEventListener('play', handlePlay);
    };
  }, []);

  useEffect(() => {
    // let's grab a quick 4 character pairing code so it's easy for the user
    const randomId = Math.random().toString(36).substring(2, 6).toUpperCase();
    
    peerRef.current = new Peer(randomId, {
      debug: 2
    });

    peerRef.current.on('open', (id) => {
      setPeerId(id);
      setStatus('ready');
    });

    peerRef.current.on('connection', (conn) => {
      connRef.current = conn;
      setStatus('connected');

      conn.on('data', (data) => {
        // Did we get a file chunk?
        if (data && data.type === 'file_chunk') {
           if (data.index === 0) {
               // init the buffer array
               chunksRef.current = new Array(data.total);
               setTransferProgress(0);
               setActiveTrack('Receiving ' + data.name + '...');
           }
           chunksRef.current[data.index] = data.data;
           
           // ping back an ack so we don't flood the network limits
           conn.send({ type: 'ack', index: data.index });

           setTransferProgress(Math.round(((data.index + 1) / data.total) * 100));

           if (data.index === data.total - 1) {
               // got all chunks, stitch it together
               const blob = new Blob(chunksRef.current, { type: data.mime });
               const url = URL.createObjectURL(blob);
               setActiveTrack(data.name);
               
               if (audioRef.current) {
                 audioRef.current.src = url;
                 
                 // gotta wait until the mp3 headers are parsed before we tell the controller we're ready
                 // otherwise Safari/Chrome will kill the play() request
                 audioRef.current.oncanplay = () => {
                    console.log('Audio is buffered and ready to go');
                    conn.send({ type: 'status', event: 'loaded' });
                    setTransferProgress(0);
                    audioRef.current.oncanplay = null;
                 };
                 audioRef.current.onerror = (e) => {
                    console.error("Failed to load audio source:", e);
                    conn.send({ type: 'status', event: 'loaded' }); 
                    setTransferProgress(0);
                 };
                 audioRef.current.load();
                 
                 // manual gc
                 chunksRef.current = [];
               }
           }
        } 
        else if (data.command) {
          // incoming media controls from the host
          if (!audioRef.current) return;

          switch (data.command) {
            case 'play':
              const playPromise = audioRef.current.play();
              if (playPromise !== undefined) {
                playPromise.catch(error => {
                  console.error("Autoplay prevented on receiver. Waiting for user interaction.", error);
                });
              }
              break;
            case 'pause':
              audioRef.current.pause();
              break;
            case 'seek':
              audioRef.current.currentTime = data.time;
              break;
            case 'volume':
              audioRef.current.volume = data.value;
              break;
            default:
              break;
          }
        }
      });
    });

    return () => {
      if (peerRef.current) {
        peerRef.current.destroy();
      }
    };
  }, []);

  // loop to sync the player state back to the Controller UI
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const syncTime = () => {
      if (connRef.current && connRef.current.open) {
        connRef.current.send({
          type: 'sync',
          currentTime: audio.currentTime,
          duration: audio.duration,
          isPlaying: !audio.paused
        });
      }
    };

    const interval = setInterval(syncTime, 1000);
    
    // tell controller to skip to next track when done
    const handleEnded = () => {
      if (connRef.current && connRef.current.open) {
        connRef.current.send({ type: 'event', event: 'ended' });
      }
    };
    
    audio.addEventListener('ended', handleEnded);

    return () => {
      clearInterval(interval);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  return (
    <div className="app-container">
      <div className="dashboard-layout">
        <div className="status-row">
          <button className="btn btn-secondary btn-icon" onClick={onBack} style={{ padding: 10 }}>
            <ArrowLeft size={18} />
          </button>
          <div className="status-badge">
            <div className={`status-dot ${status === 'connected' ? 'connected' : status === 'ready' ? '' : 'connecting'}`}></div>
            {status === 'connecting' ? 'Connecting Server' : status === 'ready' ? 'Waiting Controller' : 'Connected to Controller'}
          </div>
        </div>

        <div className="widget-card" style={{ textAlign: 'center' }}>
          {status !== 'connected' ? (
            <>
              <h2>Pairing Code</h2>
              <p>Enter this code on your Controller device</p>
              <div className="pairing-code">
                {peerId || '...'}
              </div>
              
              <p style={{ marginTop: '20px', fontSize: '0.9rem' }}>
                Ensure your speakers are on. When connected, music will play automatically.
              </p>
            </>
          ) : (
            <div style={{ padding: '20px 0', width: '100%' }}>
              <div style={{ marginBottom: 20 }}>
                 <canvas ref={canvasRef} width="300" height="120" style={{ width: '100%', height: '120px', background: 'transparent' }} />
              </div>

              <h2 className="track-title">{activeTrack ? activeTrack : "Awaiting Track..."}</h2>
              
              {transferProgress > 0 && transferProgress < 100 && (
                  <div style={{ margin: '20px auto', width: '100%' }}>
                     <div className="progress-container">
                        <div className="progress-bar" style={{ width: `${transferProgress}%` }}></div>
                     </div>
                     <p style={{ fontSize: '0.9rem' }}>Receiving... {transferProgress}%</p>
                  </div>
              )}
              
              <p style={{ marginTop: '15px' }}>Controlled dynamically by your other device.</p>
            </div>
          )}

          {/* Hidden audio element - CORS anonymous prevents the web audio context from failing */}
          <audio ref={audioRef} playsInline crossOrigin="anonymous" />
        </div>
      </div>
    </div>
  );
}
