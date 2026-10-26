import { useEffect, useState, useMemo, useRef } from 'react';
import type { CanvasEngine } from '../../engine/CanvasEngine';
import {
  getCollabPeers,
  getLocalCollabReaction,
  subscribeCollabPresence,
  type CollabPeer,
  type CollabReaction,
} from '../../store/collabPresence';

export interface RemoteCursorsOverlayProps {
  engine: CanvasEngine | null;
  camera: { x: number; y: number; zoom: number };
}

export function RemoteCursorsOverlay({ engine, camera }: RemoteCursorsOverlayProps) {
  const [peers, setPeers] = useState<CollabPeer[]>(() => getCollabPeers());
  const [localReaction, setLocalReaction] = useState<CollabReaction | null>(() => getLocalCollabReaction());

  const overlayRef = useRef<HTMLDivElement>(null);
  const peersRef = useRef<CollabPeer[]>(peers);
  const cursorNodesRef = useRef<Map<number, HTMLDivElement>>(new Map());
  const lastScreenPosRef = useRef<Map<number, { x: number; y: number }>>(new Map());

  // Keep peersRef updated immediately without waiting for React re-render
  useEffect(() => {
    return subscribeCollabPresence(() => {
      const nextPeers = getCollabPeers();
      peersRef.current = nextPeers;
      setPeers(nextPeers);
      setLocalReaction(getLocalCollabReaction());
    });
  }, []);

  // Frame-accurate camera listener decoupled from React render loop.
  // Updates cursor DOM transforms in lockstep with CanvasEngine render frames.
  useEffect(() => {
    if (!engine) return;

    const unsubscribe = engine.addCameraFrameListener(() => {
      const overlayEl = overlayRef.current;
      if (!overlayEl) return;
      const now = Date.now();
      const currentPeers = peersRef.current;

      for (const p of currentPeers) {
        if (!p.cursor || now - p.cursor.lastUpdate >= 20000) continue;
        const node = cursorNodesRef.current.get(p.clientId);
        if (!node) continue;

        const pos = engine.worldToOverlay(p.cursor.x, p.cursor.y, overlayEl);
        const x = Math.round(pos.x * 10) / 10;
        const y = Math.round(pos.y * 10) / 10;
        node.style.transform = `translate3d(${x}px, ${y}px, 0)`;
        lastScreenPosRef.current.set(p.clientId, { x, y });
      }
    });

    return unsubscribe;
  }, [engine]);

  const activeCursors = useMemo(() => {
    if (!engine) return [];
    const now = Date.now();
    const overlayEl = overlayRef.current;
    const width = typeof window !== 'undefined' ? window.innerWidth : 1920;
    const height = typeof window !== 'undefined' ? window.innerHeight : 1080;
    const margin = 160;

    return peers
      .filter(p => p.cursor && now - p.cursor.lastUpdate < 20000)
      .map(p => {
        const pos = engine.worldToOverlay(p.cursor!.x, p.cursor!.y, overlayEl);
        const screenX = Math.round(pos.x * 10) / 10;
        const screenY = Math.round(pos.y * 10) / 10;
        const age = now - p.cursor!.lastUpdate;
        const opacity = age < 10000 ? 1 : Math.max(0.35, 1 - (age - 10000) / 10000);

        // Check if movement exceeds 300px (teleport/jump)
        const lastPos = lastScreenPosRef.current.get(p.clientId);
        const isTeleport = lastPos ? (Math.hypot(screenX - lastPos.x, screenY - lastPos.y) > 300) : false;
        lastScreenPosRef.current.set(p.clientId, { x: screenX, y: screenY });

        const isDrawing = Boolean(p.cursor!.isDrawing);

        return {
          peer: p,
          screenX,
          screenY,
          opacity,
          isDrawing,
          isTeleport,
          isVisible: screenX >= -margin && screenX <= width + margin &&
                     screenY >= -margin && screenY <= height + margin,
        };
      })
      .filter(item => item.isVisible);
  }, [peers, engine, camera]);

  const activeReactions = useMemo(() => {
    if (!engine) return [];
    const now = Date.now();
    const overlayEl = overlayRef.current;
    const list: Array<{ id: string; emoji: string; screenX: number; screenY: number }> = [];

    // Peer reactions
    for (const p of peers) {
      if (p.reaction && now - p.reaction.timestamp < 2800) {
        const pos = engine.worldToOverlay(p.reaction.x, p.reaction.y, overlayEl);
        list.push({
          id: p.reaction.id,
          emoji: p.reaction.emoji,
          screenX: Math.round(pos.x * 10) / 10,
          screenY: Math.round(pos.y * 10) / 10,
        });
      }
    }

    // Local reaction
    if (localReaction && now - localReaction.timestamp < 2800) {
      const pos = engine.worldToOverlay(localReaction.x, localReaction.y, overlayEl);
      list.push({
        id: localReaction.id,
        emoji: localReaction.emoji,
        screenX: Math.round(pos.x * 10) / 10,
        screenY: Math.round(pos.y * 10) / 10,
      });
    }

    return list;
  }, [peers, localReaction, engine, camera]);

  if (activeCursors.length === 0 && activeReactions.length === 0) return null;

  return (
    <div
      ref={overlayRef}
      className="remote-cursors-layer"
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
        zIndex: 40,
      }}
      aria-hidden="true"
    >
      {activeCursors.map(({ peer, screenX, screenY, opacity, isDrawing, isTeleport }) => (
        <div
          key={peer.clientId}
          ref={el => {
            if (el) cursorNodesRef.current.set(peer.clientId, el);
            else cursorNodesRef.current.delete(peer.clientId);
          }}
          className="remote-cursor-container"
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            transform: `translate3d(${screenX}px, ${screenY}px, 0)`,
            transition: isDrawing || isTeleport ? 'none' : 'transform 20ms linear, opacity 250ms ease-out',
            opacity,
            willChange: 'transform, opacity',
            pointerEvents: 'none',
          }}
        >
          {/* Authentic Miro-grade Arrow Cursor Pointer */}
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            className="remote-cursor-pointer"
            style={{
              overflow: 'visible',
              filter: 'drop-shadow(0 2px 5px rgba(0, 0, 0, 0.28))',
            }}
          >
            <path
              d="M0 0L0 16.5L4.5 12.5L8.2 20.5L10.8 19.5L7.2 11.5L13.5 11.5Z"
              fill={peer.user.color}
              stroke="#ffffff"
              strokeWidth="1.5"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </svg>

          {/* Miro-style Anchored Name Badge Tag */}
          <div
            className="remote-cursor-badge"
            style={{
              backgroundColor: peer.user.color,
              color: peer.user.textColor,
            }}
          >
            <span className="remote-cursor-name">{peer.user.name}</span>
          </div>
        </div>
      ))}

      {/* Miro-style Floating Animated Reactions */}
      {activeReactions.map(r => (
        <div
          key={r.id}
          className="floating-reaction"
          style={{
            position: 'absolute',
            left: r.screenX,
            top: r.screenY,
            pointerEvents: 'none',
          }}
        >
          <span className="floating-reaction-emoji">{r.emoji}</span>
        </div>
      ))}
    </div>
  );
}
