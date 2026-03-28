/**
 * Controller Component
 * Built by: Kanaiya L Datwani (Proud Hindu - Sanatani)
 * 
 * Drives the UI to pick music, send chunks to the receiver over WebRTC,
 * and maintains sync with playback state.
 */
import React, { useState, useRef, useEffect } from 'react';
import { Peer } from 'peerjs';
import { ArrowLeft, Play, Pause, SkipBack, SkipForward, VolumeX, Volume2, Upload, Music, Repeat, Shuffle } from 'lucide-react';

export default function Controller({ onBack }) {
  const [pairingCode, setPairingCode] = useState('');
  const [status, setStatus] = useState('disconnected');
  const [files, setFiles] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isSending, setIsSending] = useState(false);
  const [transferProgress, setTransferProgress] = useState(0);
  const [isLooping, setIsLooping] = useState(false);
  const [isShuffle, setIsShuffle] = useState(false);

  const peerRef = useRef(null);
  const connRef = useRef(null);
  const transferRef = useRef(null);
  const onEndedRef = useRef();

  useEffect(() => {
    peerRef.current = new Peer({ debug: 2 });
    
    return () => {
      if (peerRef.current) peerRef.current.destroy();
    };
  }, []);

  const handleConnect = (e) => {
    e.preventDefault();
    if (!pairingCode) return;
    
    setStatus('connecting');
    const conn = peerRef.current.connect(pairingCode.toUpperCase(), { reliable: true });
    
    conn.on('open', () => {
      connRef.current = conn;
      setStatus('connected');
    });

    conn.on('data', (data) => {
      if (data.type === 'sync') {
        setCurrentTime(data.currentTime);
        setDuration(data.duration || 0);
        setIsPlaying(data.isPlaying);
      } else if (data.type === 'ack') {
          // got an ack from receiver, keep sending next chunk
          if (transferRef.current && transferRef.current.currentChunk === data.index && !transferRef.current.isCancelled) {
              transferRef.current.currentChunk++;
              sendNextChunk();
          }
      } else if (data.type === 'status' && data.event === 'loaded') {
         setIsSending(false);
         // receiver is buffered up, force it to hit play
         conn.send({ command: 'play' });
         setIsPlaying(true);
      } else if (data.type === 'event' && data.event === 'ended') {
         if (onEndedRef.current) onEndedRef.current();
      }
    });

    conn.on('close', () => {
      setStatus('disconnected');
    });
  };

  const handleFileSelect = (e) => {
    if (e.target.files.length > 0) {
      const selectedFiles = Array.from(e.target.files);
      setFiles(prev => [...prev, ...selectedFiles]);
      // auto-start playing if this is the first track added
      if (currentIndex === -1) {
        playTrack(selectedFiles[0], 0);
      }
    }
  };

  const playTrack = async (file, index) => {
    if (!connRef.current || !connRef.current.open) return;
    
    setCurrentIndex(index);
    setIsSending(true);
    setTransferProgress(0);
    
    // ditch any active chunk transfers from skipping too fast
    if (transferRef.current) {
        transferRef.current.isCancelled = true;
    }
    
    // push track title first
    connRef.current.send({ command: 'trackInfo', name: file.name });
    
    // time to chunk up the raw file. 128KB hits the sweet spot for WebRTC data channels
    const CHUNK_SIZE = 128 * 1024; 
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    
    transferRef.current = {
      file,
      totalChunks,
      currentChunk: 0,
      chunkSize: CHUNK_SIZE,
      isCancelled: false
    };

    sendNextChunk();
  };

  const sendNextChunk = async () => {
    const transfer = transferRef.current;
    if (!transfer || transfer.isCancelled || !connRef.current || !connRef.current.open) return;

    if (transfer.currentChunk >= transfer.totalChunks) {
       return;
    }

    const start = transfer.currentChunk * transfer.chunkSize;
    const end = Math.min(start + transfer.chunkSize, transfer.file.size);
    const slice = transfer.file.slice(start, end);
    const buffer = await slice.arrayBuffer();

    connRef.current.send({
        type: 'file_chunk',
        name: transfer.file.name,
        mime: transfer.file.type,
        index: transfer.currentChunk,
        total: transfer.totalChunks,
        data: buffer
    });
    
    setTransferProgress(Math.round(((transfer.currentChunk + 1) / transfer.totalChunks) * 100));
  };

  const togglePlay = () => {
    if (!connRef.current) return;
    
    if (isPlaying) {
      connRef.current.send({ command: 'pause' });
      setIsPlaying(false);
    } else {
      if (currentIndex === -1 && files.length > 0) {
        playTrack(files[0], 0);
      } else if (currentIndex !== -1) {
        connRef.current.send({ command: 'play' });
        setIsPlaying(true);
      }
    }
  };

  const handleNext = () => {
    if (currentIndex < files.length - 1) {
      playTrack(files[currentIndex + 1], currentIndex + 1);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      playTrack(files[currentIndex - 1], currentIndex - 1);
    }
  };

  const handleSeek = (e) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if (connRef.current && connRef.current.open) {
      connRef.current.send({ command: 'seek', time });
    }
  };

  const handleVolume = (e) => {
    const newVol = parseFloat(e.target.value);
    setVolume(newVol);
    if (connRef.current && connRef.current.open) {
      connRef.current.send({ command: 'volume', value: newVol });
    }
  };

  const toggleLoop = () => setIsLooping(!isLooping);
  const toggleShuffle = () => setIsShuffle(!isShuffle);

  onEndedRef.current = () => {
      if (isLooping) {
         connRef.current.send({ command: 'seek', time: 0 });
         connRef.current.send({ command: 'play' });
      } else if (isShuffle) {
         const next = Math.floor(Math.random() * files.length);
         playTrack(files[next], next);
      } else {
         handleNext();
      }
  };

  const activeTrack = currentIndex >= 0 ? files[currentIndex] : null;

  return (
    <div className="app-container">
      <div className="dashboard-layout" style={{ position: 'relative' }}>
        <div className="status-row">
          <button className="btn btn-secondary btn-icon" onClick={onBack} style={{ padding: 10 }}>
            <ArrowLeft size={18} />
          </button>
          <div className="status-badge">
            <div className={`status-dot ${status === 'connected' ? 'connected' : status === 'connecting' ? 'connecting' : ''}`}></div>
            {status === 'connected' ? 'Connected' : status === 'connecting' ? 'Connecting...' : 'Not Connected'}
          </div>
        </div>

        {status !== 'connected' ? (
          <div className="widget-card">
              <form onSubmit={handleConnect} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <h2 style={{ textAlign: 'center', margin: 0 }}>Pair Device</h2>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="ENTER CODE" 
                  value={pairingCode}
                  onChange={(e) => setPairingCode(e.target.value)}
                  required
                  maxLength={6}
                />
                <button type="submit" className="btn btn-primary" disabled={status === 'connecting'}>
                  Establish Connection
                </button>
              </form>
          </div>
        ) : (
          <>
            <div className="widget-card now-playing" style={{ paddingBottom: 24 }}>
              <div style={{ position: 'relative', width: 140, height: 140, margin: '0 auto 20px auto' }}>
                  <svg width="140" height="140" viewBox="0 0 140 140" style={{ transform: 'rotate(-90deg)' }}>
                      <circle cx="70" cy="70" r="64" fill="transparent" stroke="var(--card-border)" strokeWidth="6" />
                      <circle 
                         cx="70" cy="70" r="64" 
                         fill="transparent" 
                         stroke="var(--accent-color)" 
                         strokeWidth="6" 
                         strokeDasharray={2 * Math.PI * 64} 
                         strokeDashoffset={(2 * Math.PI * 64) - ((currentTime / (duration || 1)) * (2 * Math.PI * 64))} 
                         strokeLinecap="round" 
                         style={{ transition: 'stroke-dashoffset 0.5s linear' }} 
                      />
                  </svg>
                  <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Music size={32} color="var(--accent-color)" />
                  </div>
              </div>
              
              {activeTrack ? (
                <>
                  <div className="track-title">{activeTrack.name}</div>
                  <p>{isSending ? "Syncing track data buffer..." : "Playing on Remote Receiver"}</p>
                </>
              ) : (
                <>
                  <div className="track-title">No Track Selected</div>
                  <p>Upload music below to begin.</p>
                </>
              )}
            </div>

            <div className="widget-card">
              <div style={{ marginBottom: '15px' }}>
                <input 
                  type="range" 
                  min="0" 
                  max={duration || 100} 
                  value={currentTime} 
                  onChange={handleSeek}
                  style={{ width: '100%', accentColor: 'var(--accent-color)', height: 4, cursor: 'pointer' }}
                  disabled={!activeTrack || isSending}
                />
                <div className="time-display" style={{ marginTop: 8 }}>
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>

              {isSending && (
                  <div className="progress-container" style={{ margin: '5px auto 15px auto', width: '100%' }}>
                    <div className="progress-bar" style={{ width: `${transferProgress}%` }}></div>
                     <div style={{ fontSize: '0.8rem', marginTop: '6px', textAlign: 'center', color: 'var(--accent-color)' }}>
                       Transferring Audio... {transferProgress}%
                    </div>
                  </div>
              )}

              <div className="controls-row" style={{ marginTop: 10 }}>
                <button className={`btn btn-secondary btn-icon`} onClick={toggleShuffle} style={{ borderColor: isShuffle ? 'var(--accent-color)' : 'transparent', color: isShuffle ? 'var(--accent-color)' : 'var(--text-secondary)' }}>
                    <Shuffle size={18} />
                </button>
                <button className="btn btn-secondary btn-icon" onClick={handlePrev} disabled={currentIndex <= 0}>
                  <SkipBack size={22} />
                </button>
                <button className="btn btn-play" onClick={togglePlay} disabled={files.length === 0 || isSending}>
                  {isPlaying ? <Pause fill="currentColor" size={28} /> : <Play fill="currentColor" size={28} />}
                </button>
                <button className="btn btn-secondary btn-icon" onClick={handleNext} disabled={currentIndex >= files.length - 1}>
                  <SkipForward size={22} />
                </button>
                <button className={`btn btn-secondary btn-icon`} onClick={toggleLoop} style={{ borderColor: isLooping ? 'var(--accent-color)' : 'transparent', color: isLooping ? 'var(--accent-color)' : 'var(--text-secondary)' }}>
                    <Repeat size={18} />
                </button>
              </div>
            </div>

            <div className="widget-card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 15 }}>
               <VolumeX size={18} color="var(--text-secondary)" />
               <input 
                  type="range" 
                  min="0" 
                  max="1" 
                  step="0.01"
                  value={volume} 
                  onChange={handleVolume}
                  style={{ flex: 1, accentColor: 'var(--accent-secondary)', height: 4, cursor: 'pointer' }}
                />
               <Volume2 size={18} color="var(--text-secondary)" />
            </div>

            <div className="widget-card" style={{ padding: '20px' }}>
               <label className="file-label" style={{ padding: '16px' }}>
                  <input type="file" className="file-input" multiple accept="audio/*" onChange={handleFileSelect} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Upload size={20} style={{ opacity: 0.7 }} />
                    <span style={{ fontWeight: 500 }}>Upload Local Audio</span>
                  </div>
               </label>
               
              {files.length > 0 && (
                <div className="playlist">
                  {files.map((file, i) => (
                    <div 
                      key={i} 
                      className={`playlist-item ${i === currentIndex ? 'active' : ''}`}
                      onClick={() => playTrack(file, i)}
                    >
                      <Music size={16} style={{ minWidth: 16 }} />
                      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {file.name}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function formatTime(secs) {
  if (!secs || isNaN(secs)) return '0:00';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}
