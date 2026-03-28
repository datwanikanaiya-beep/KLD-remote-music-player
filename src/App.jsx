import React, { useState } from 'react';
import { RadioReceiver, Smartphone } from 'lucide-react';
import Receiver from './components/Receiver';
import Controller from './components/Controller';

function App() {
  const [role, setRole] = useState(null);

  if (role === 'receiver') {
    return <Receiver onBack={() => setRole(null)} />;
  }

  if (role === 'controller') {
    return <Controller onBack={() => setRole(null)} />;
  }

  return (
    <div className="app-container">
      <div className="dashboard-layout">
        <div className="widget-card role-selector">
          <h1>Remote Play</h1>
          <p>Select the role for this device to begin.</p>
          
          <div className="role-cards" style={{ marginTop: '30px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <button 
              className="btn btn-secondary" 
              style={{ padding: '24px', flexDirection: 'column', gap: '16px' }}
              onClick={() => setRole('receiver')}
            >
              <RadioReceiver size={48} color="var(--accent-color)" />
              <div>
                <h2>Receiver</h2>
                <p style={{ fontSize: '0.9rem' }}>Connect this device to speakers. It will play the music.</p>
              </div>
            </button>

            <button 
              className="btn btn-secondary" 
              style={{ padding: '24px', flexDirection: 'column', gap: '16px' }}
              onClick={() => setRole('controller')}
            >
              <Smartphone size={48} color="var(--accent-secondary)" />
              <div>
                <h2>Controller</h2>
                <p style={{ fontSize: '0.9rem' }}>Use this device to pick and control the music.</p>
              </div>
            </button>
          </div>

          <div style={{ marginTop: '40px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
             Designed & Developed by <strong style={{ color: 'var(--text-primary)' }}>Kanaiya L Datwani</strong>
             <br />
             <span style={{ fontStyle: 'italic', opacity: 0.8 }}>Proud Hindu (Sanatani)</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
