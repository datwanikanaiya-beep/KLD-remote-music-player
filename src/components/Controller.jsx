/**
 * Controller Component
 * Built by: Kanaiya L Datwani (Proud Hindu - Sanatani)
 * 
 * Drives the UI to pick music, send chunks to the receiver over WebRTC,
 * and maintains sync with playback state.
 */
import React, { useState, useRef, useEffect } from 'react';
import { Peer } from 'peerjs';
import { ArrowLeft, Play, Pause, SkipBack, SkipForward, VolumeX, Volume2, Upload, Music } from 'lucide-react';

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

  const peerRef = useRef(null);
  const connRef = useRef(null);
  const transferRef = useRef(null);

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
         handleNext();
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
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
    if (connRef.current) {
      connRef.current.send({ command: 'seek', time: newTime });
    }
  };

  const activeTrack = currentIndex >= 0 ? files[currentIndex] : null;

  return (
    <div className="app-container">
      <div className="glass-panel controller-view" style={{ position: 'relative' }}>
        <button className="btn btn-secondary" onClick={onBack} style={{ position: 'absolute', top: 20, left: 20, zIndex: 10 }}>
          <ArrowLeft size={20} />
        </button>

        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div className="status-badge">
            <div className={`status-dot ${status === 'connected' ? 'connected' : status === 'connecting' ? 'connecting' : ''}`}></div>
            {status === 'connected' ? 'Connected to Receiver' : status === 'connecting' ? 'Connecting...' : 'Not Connected'}
          </div>
        </div>

        {status !== 'connected' ? (
          <form onSubmit={handleConnect} style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '40px' }}>
            <h2 style={{ textAlign: 'center' }}>Pair Device</h2>
            <input 
              type="text" 
              className="input-field" 
              placeholder="ENTER PAIRING CODE" 
              value={pairingCode}
              onChange={(e) => setPairingCode(e.target.value)}
              required
              maxLength={6}
            />
            <button type="submit" className="btn btn-primary" disabled={status === 'connecting'}>
              Connect
            </button>
          </form>
        ) : (
          <div>
            <div className="now-playing">
              {activeTrack ? (
                <>
                  <div className="track-title">{activeTrack.name}</div>
                  <p>{isSending ? "Sending track data to receiver..." : "Now Playing on Receiver"}</p>
                  {isSending && (
                      <div className="progress-container" style={{ margin: '15px auto', width: '80%' }}>
                        <div className="progress-bar" style={{ width: `${transferProgress}%` }}></div>
                        <div style={{ fontSize: '0.8rem', marginTop: '8px', color: 'var(--text-secondary)' }}>
                           Transferring... {transferProgress}%
                        </div>
                      </div>
                  )}
                </>
              ) : (
                <>
                  <div className="track-title">No Track Selected</div>
                  <p>Add some music to start playing.</p>
                </>
              )}
            </div>

            <div className="controls-row">
              <button className="btn btn-secondary btn-icon" onClick={handlePrev} disabled={currentIndex <= 0}>
                <SkipBack />
              </button>
              <button className="btn btn-play btn-icon btn-icon-large" onClick={togglePlay} disabled={files.length === 0 || isSending}>
                {isPlaying ? <Pause fill="currentColor" /> : <Play fill="currentColor" />}
              </button>
              <button className="btn btn-secondary btn-icon" onClick={handleNext} disabled={currentIndex >= files.length - 1}>
                <SkipForward />
              </button>
            </div>

            <div style={{ marginTop: '20px' }}>
              <input 
                type="range" 
                min="0" 
                max={duration || 100} 
                value={currentTime} 
                onChange={handleSeek}
                style={{ width: '100%', accentColor: 'var(--accent-color)' }}
                disabled={!activeTrack || isSending}
              />
              <div className="time-display">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            <div style={{ marginTop: '30px' }}>
               <label className="file-label">
                  <input type="file" className="file-input" multiple accept="audio/*" onChange={handleFileSelect} />
                  <Upload size={32} style={{ marginBottom: 12, opacity: 0.7 }} />
                  <div>Select Local Audio Files</div>
               </label>
            </div>

            {files.length > 0 && (
              <div className="playlist">
                <h3 style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginBottom: '10px' }}>Queue</h3>
                {files.map((file, i) => (
                  <div 
                    key={i} 
                    className={`playlist-item ${i === currentIndex ? 'active' : ''}`}
                    onClick={() => playTrack(file, i)}
                  >
                    <Music size={16} />
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {file.name}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
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
