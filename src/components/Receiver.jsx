/**
 * Receiver Component
 * Written by: Kanaiya L Datwani (Proud Hindu - Sanatani)
 * 
 * Handles the WebRTC data incoming chunks and reconstructs the audio file
 * to play locally. Also beams playback state back to the controller.
 */
import React, { useState, useEffect, useRef } from 'react';
import { Peer } from 'peerjs';
import { ArrowLeft, Music, Activity } from 'lucide-react';

export default function Receiver({ onBack }) {
  const [peerId, setPeerId] = useState('');
  const [status, setStatus] = useState('connecting');
  const [activeTrack, setActiveTrack] = useState(null);
  const [transferProgress, setTransferProgress] = useState(0);
  
  const peerRef = useRef(null);
  const connRef = useRef(null);
  const audioRef = useRef(null);
  const chunksRef = useRef([]);

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
          console.log('Got command:', data);
          if (!audioRef.current) return;

          switch (data.command) {
            case 'play':
              audioRef.current.play().catch(e => console.error("Play error:", e));
              break;
            case 'pause':
              audioRef.current.pause();
              break;
            case 'seek':
              audioRef.current.currentTime = data.time;
              break;
            case 'volume':
              audioRef.current.volume = data.volume;
              break;
            case 'trackInfo':
              setActiveTrack(data.name);
              break;
            default:
              break;
          }
        }
      });

      conn.on('close', () => {
        setStatus('ready');
        setActiveTrack(null);
        if (audioRef.current) audioRef.current.pause();
      });
    });

    peerRef.current.on('disconnected', () => {
      setStatus('disconnected');
    });

    return () => {
      if (peerRef.current) peerRef.current.destroy();
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
  }, [status]);

  return (
    <div className="app-container">
      <div className="glass-panel receiver-view" style={{ textAlign: 'center' }}>
        <button className="btn btn-secondary" onClick={onBack} style={{ position: 'absolute', top: 20, left: 20 }}>
          <ArrowLeft size={20} />
        </button>

        <div className="status-badge" style={{ marginTop: '20px' }}>
          <div className={`status-dot ${status === 'connected' ? 'connected' : status === 'ready' ? '' : 'connecting'}`}></div>
          {status === 'connecting' ? 'Connecting to Server...' : status === 'ready' ? 'Waiting for Controller' : 'Connected to Controller'}
        </div>

        {status !== 'connected' ? (
          <>
            <h2>Pairing Code</h2>
            <p>Enter this code on your Controller device</p>
            <div className="pairing-code">
              {peerId || '...'}
            </div>
            
            <p style={{ marginTop: '30px', fontSize: '0.9rem' }}>
              Ensure your speakers are on. When connected, music will play automatically.
            </p>
          </>
        ) : (
          <div style={{ padding: '40px 0' }}>
            <Activity size={64} color="var(--accent-color)" className={activeTrack ? "connecting" : ""} style={{ marginBottom: 20 }} />
            <h2>{activeTrack ? activeTrack : "Awaiting Track..."}</h2>
            
            {transferProgress > 0 && transferProgress < 100 && (
                <div style={{ margin: '20px auto', width: '80%' }}>
                   <div className="progress-container">
                      <div className="progress-bar" style={{ width: `${transferProgress}%` }}></div>
                   </div>
                   <p style={{ fontSize: '0.9rem' }}>Receiving... {transferProgress}%</p>
                </div>
            )}
            
            <p>Controlled dynamically by your other device.</p>
          </div>
        )}

        {/* Hidden audio element */}
        <audio ref={audioRef} playsInline crossOrigin="anonymous" />
      </div>
    </div>
  );
}
