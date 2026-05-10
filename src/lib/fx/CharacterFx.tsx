'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import type { FxDescriptor } from './types'
import { FxScene } from './engine'

interface CharacterFxProps {
  descriptor: FxDescriptor
  children: ReactNode
  // Bleed in pixels — how far the canvas extends past the card on each side.
  // Demi's `out` layer scales 1.05, so a few px of bleed is enough.
  bleed?: number
  // Multiplier on shader time. 1 = raw seconds; 0.1 = ten times slower.
  speedScale?: number
  // Compensation factor for particle world size (Canvas scaler unknown).
  particleSizeFactor?: number
}

export default function CharacterFx({
  descriptor,
  children,
  bleed = 6,
  speedScale = 1.0,
  particleSizeFactor = 0.25,
}: CharacterFxProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sceneRef = useRef<FxScene | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return

    const scene = new FxScene(canvas)
    sceneRef.current = scene
    scene.setSpeedScale(speedScale)
    scene.setParticleSizeFactor(particleSizeFactor)
    let cancelled = false

    const sync = () => {
      const rect = wrap.getBoundingClientRect()
      scene.resize(Math.round(rect.width), Math.round(rect.height), bleed)
    }

    const ro = new ResizeObserver(sync)
    ro.observe(wrap)
    sync()

    scene.load(descriptor).then(() => {
      if (cancelled) return
      scene.start()
    })

    return () => {
      cancelled = true
      ro.disconnect()
      scene.dispose()
      sceneRef.current = null
    }
    // speedScale changes are pushed via the second effect; no need to remount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [descriptor, bleed])

  useEffect(() => {
    sceneRef.current?.setSpeedScale(speedScale)
  }, [speedScale])

  useEffect(() => {
    sceneRef.current?.setParticleSizeFactor(particleSizeFactor)
  }, [particleSizeFactor])

  return (
    <div
      ref={wrapRef}
      style={{ position: 'relative', display: 'inline-block', isolation: 'isolate' }}
    >
      {children}
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          top: -bleed,
          left: -bleed,
          pointerEvents: 'none',
          zIndex: 10,
          mixBlendMode: 'plus-lighter',
        }}
      />
    </div>
  )
}
