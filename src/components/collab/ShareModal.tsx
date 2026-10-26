import * as React from 'react';
import { useEffect, useState, useMemo } from 'react';
import {
  Link2, Check, Globe, X, Wifi, HelpCircle,
  ChevronDown, Lock
} from 'lucide-react';
import type { CollabPeer, CollabUser } from '../../store/collabPresence';
import { encodeBoardToken } from '../../store/boardSecurity';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  boardId: string;
  collabPeers?: CollabPeer[];
  collabUser?: CollabUser | null;
}

interface NetworkInfoResponse {
  ips?: string[];
  port?: number;
}

export function ShareModal({
  isOpen,
  onClose,
  boardId,
  collabPeers = [],
  collabUser = null,
}: ShareModalProps): React.ReactElement | null {
  const [networkIps, setNetworkIps] = useState<string[]>([]);
  const [serverPort, setServerPort] = useState<number>(5175);
  const [useLocalhost, setUseLocalhost] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [showHelp, setShowHelp] = useState<boolean>(false);
  const [originInfo, setOriginInfo] = useState({ origin: '', host: '', protocol: 'http:' });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOriginInfo({
        origin: window.location.origin,
        host: window.location.host,
        protocol: window.location.protocol,
      });
    }

    fetch('/api/network-info')
      .then(res => res.json())
      .then((data: NetworkInfoResponse) => {
        if (Array.isArray(data.ips) && data.ips.length > 0) {
          setNetworkIps(data.ips);
        }
        if (typeof data.port === 'number') {
          setServerPort(data.port);
        }
      })
      .catch(() => {});
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const encryptedToken = useMemo(() => encodeBoardToken(boardId), [boardId, isOpen]);

  if (!isOpen) return null;

  const currentPort = typeof window !== 'undefined' && window.location.port ? window.location.port : serverPort;
  const primaryLanIp = networkIps[0] || '';
  const isLocalEnvironment = originInfo.host.includes('localhost') || originInfo.host.includes('127.0.0.1');

  // Compute share URL with cryptographically secure token to prevent room enumeration
  let activeUrl = `${originInfo.origin}/?token=${encodeURIComponent(encryptedToken)}`;
  if (isLocalEnvironment && primaryLanIp && !useLocalhost) {
    activeUrl = `${originInfo.protocol}//${primaryLanIp}:${currentPort}/?token=${encodeURIComponent(encryptedToken)}`;
  } else if (useLocalhost) {
    activeUrl = `${originInfo.protocol}//localhost:${currentPort}/?token=${encodeURIComponent(encryptedToken)}`;
  }

  const handleCopy = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(activeUrl);
      } else {
        const input = document.createElement('input');
        input.value = activeUrl;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  return (
    <div
      className="share-modal-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-modal-title"
    >
      <div className="share-modal-card" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="share-modal-header">
          <div className="share-modal-title-wrap">
            <h2 id="share-modal-title" className="share-modal-heading">
              Share board
            </h2>
            <span className="share-modal-lock-badge" title="Cryptographically tokenized share link">
              <Lock size={11} />
              <span>Encrypted</span>
            </span>
          </div>
          <button
            type="button"
            className="share-modal-close"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X size={16} />
          </button>
        </div>

        {/* General Access Row */}
        <div className="share-access-row">
          <div className="share-access-left">
            <div className="share-access-icon-box">
              <Globe size={16} className="text-slate-600" />
            </div>
            <div className="share-access-text">
              <span className="share-access-title">Anyone with the link</span>
              <span className="share-access-desc">Can view and edit with secure link token</span>
            </div>
          </div>
          <div className="share-permission-pill" title="Public real-time edit access">
            <span>Can edit</span>
            <ChevronDown size={13} className="text-slate-400" />
          </div>
        </div>

        {/* Link input & Copy button */}
        <div className="share-link-input-group">
          <div className="share-link-field">
            <Link2 size={14} className="share-link-icon" />
            <input
              type="text"
              readOnly
              value={activeUrl}
              onFocus={e => e.target.select()}
              className="share-link-input"
              aria-label="Shareable link"
            />
          </div>
          <button
            type="button"
            onClick={handleCopy}
            className={`share-action-copy-btn ${copied ? 'is-copied' : ''}`}
          >
            {copied ? (
              <>
                <Check size={14} strokeWidth={2.5} />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Link2 size={14} strokeWidth={2} />
                <span>Copy link</span>
              </>
            )}
          </button>
        </div>

        {/* Host mode switcher */}
        {primaryLanIp && isLocalEnvironment && (
          <div className="share-network-subtext">
            <div className="share-network-info">
              <Wifi size={12} className="text-blue-500" />
              <span>
                {useLocalhost
                  ? 'Link set to Localhost (current device only)'
                  : `Link configured for Wi-Fi peers (${primaryLanIp}:${currentPort})`}
              </span>
            </div>
            <button
              type="button"
              className="share-network-toggle-btn"
              onClick={() => setUseLocalhost(prev => !prev)}
            >
              {useLocalhost ? 'Use Wi-Fi IP' : 'Use Localhost'}
            </button>
          </div>
        )}

        {/* Collaborators List */}
        <div className="share-collaborators-section">
          <div className="share-collaborators-header">
            <span>People on this board</span>
            <span className="share-online-count">
              {collabPeers.length + 1} online
            </span>
          </div>

          <div className="share-collaborators-list">
            {/* Local User */}
            <div className="share-collaborator-item">
              <div
                className="share-avatar-circle"
                style={{
                  background: collabUser ? collabUser.gradient : '#3b82f6',
                  color: '#ffffff',
                }}
              >
                {collabUser ? collabUser.avatarLabel : 'U'}
              </div>
              <div className="share-collab-info">
                <span className="share-collab-name">
                  {collabUser ? collabUser.name : 'You'} <span className="share-you-badge">(You)</span>
                </span>
                <span className="share-collab-status">Active now</span>
              </div>
              <span className="share-role-text">Editor</span>
            </div>

            {/* Remote Peers */}
            {collabPeers.map(peer => (
              <div key={peer.clientId} className="share-collaborator-item">
                <div
                  className="share-avatar-circle"
                  style={{
                    background: peer.user.gradient,
                    color: '#ffffff',
                  }}
                >
                  {peer.user.avatarLabel}
                </div>
                <div className="share-collab-info">
                  <span className="share-collab-name">{peer.user.name}</span>
                  <span className="share-collab-status">Active now</span>
                </div>
                <span className="share-role-text">Editor</span>
              </div>
            ))}
          </div>
        </div>

        {/* Quiet Help Drawer */}
        {showHelp && (
          <div className="share-help-drawer">
            <div className="share-help-tip">
              <strong>Wi-Fi connection tip:</strong> Ensure peers are on the same Wi-Fi router. If friends see connection errors, allow Node.js or port <code>{currentPort}</code> in Windows Defender Firewall.
            </div>
            <div className="share-help-tip">
              <strong>Remote collaboration:</strong> To share over the internet, run a tunnel like <code>ngrok http {currentPort}</code> and share that URL.
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="share-modal-footer">
          <button
            type="button"
            className="share-help-trigger"
            onClick={() => setShowHelp(prev => !prev)}
          >
            <HelpCircle size={13} />
            <span>{showHelp ? 'Hide connection tips' : 'Connection help'}</span>
          </button>
          <button
            type="button"
            className="share-done-button"
            onClick={onClose}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
