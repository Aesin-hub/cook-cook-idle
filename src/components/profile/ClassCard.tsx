import { useState } from 'react'
import { usePlayerStore } from '../../stores/usePlayerStore'
import { ProgressBar } from '../shared/ProgressBar'
import classesData from '../../data/classes.json'
import type { ClassId, ClassDefinition } from '../../types/player'

const CLASS_COLORS: Record<ClassId, string> = {
  recolteur:   '#00d2ff',
  artisan:     '#bf5af2',
  cuisinier:   '#ff9500',
  explorateur: '#30d158',
  chasseur:    '#ff453a',
  erudit:      '#ffd500',
}

interface ClassCardProps {
  classId: ClassId
}

export function ClassCard({ classId }: ClassCardProps) {
  const [expanded, setExpanded] = useState(false)

  const level = usePlayerStore((s) => s.getClassLevel(classId))
  const progress = usePlayerStore((s) => s.getClassProgress(classId))
  const xp = usePlayerStore((s) => s.getClassXp(classId))

  const classDef = (classesData.classes as ClassDefinition[]).find((c) => c.id === classId)!
  const color = CLASS_COLORS[classId]
  const maxLevel = classDef.levels.length
  const isMaxed = level >= maxLevel
  const nextLevel = classDef.levels.find((l) => l.level === level + 1)
  const xpToNext = nextLevel ? nextLevel.xpRequired - xp : 0

  return (
    <div style={{
      background: '#161b22',
      border: `1px solid ${level > 0 ? `${color}30` : 'rgba(255,255,255,0.06)'}`,
      borderRadius: '12px',
      padding: '14px',
      transition: 'border-color 0.2s ease',
    }}>
      {/* Header */}
      <div
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
        onClick={() => setExpanded((v) => !v)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '24px' }}>{classDef.emoji}</span>
          <div>
            <div style={{ fontSize: '15px', fontWeight: 600, color: level > 0 ? '#e2e8f0' : '#636e8a' }}>
              {classDef.name}
            </div>
            <div style={{ fontSize: '11px', color: '#636e8a' }}>
              {classDef.description}
            </div>
          </div>
        </div>

        <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '8px' }}>
          <div style={{ fontSize: '18px', fontWeight: 700, color: level > 0 ? color : '#4a5568' }}>
            {level}<span style={{ fontSize: '12px', color: '#636e8a', fontWeight: 400 }}>/{maxLevel}</span>
          </div>
          <div style={{ fontSize: '10px', color: '#636e8a' }}>{expanded ? '▲' : '▼'}</div>
        </div>
      </div>

      {/* Barre XP */}
      <div style={{ marginTop: '10px' }}>
        <ProgressBar
          value={isMaxed ? 1 : progress}
          color={level > 0 ? color : '#4a5568'}
          height={5}
          showGlow={level > 0}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
          <span style={{ fontSize: '10px', color: '#636e8a' }}>{xp.toLocaleString()} XP</span>
          <span style={{ fontSize: '10px', color: '#636e8a' }}>
            {isMaxed ? '✅ Niveau max' : `encore ${xpToNext.toLocaleString()} XP`}
          </span>
        </div>
      </div>

      {/* Liste des niveaux */}
      {expanded && (
        <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
          {classDef.levels.map((lvl) => {
            const isUnlocked = level >= lvl.level
            const isCurrent = level + 1 === lvl.level

            return (
              <div
                key={lvl.level}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '6px 10px', borderRadius: '8px',
                  background: isUnlocked ? `${color}12` : '#0d1117',
                  border: `1px solid ${isCurrent ? `${color}40` : 'transparent'}`,
                  opacity: isUnlocked ? 1 : 0.5,
                }}
              >
                <div style={{
                  width: '20px', height: '20px', borderRadius: '50%', flexShrink: 0,
                  background: isUnlocked ? color : 'rgba(255,255,255,0.08)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '10px', fontWeight: 700,
                  color: isUnlocked ? '#0d1117' : '#636e8a',
                }}>
                  {lvl.level}
                </div>

                <span style={{ fontSize: '12px', color: isUnlocked ? '#e2e8f0' : '#636e8a', flex: 1 }}>
                  {lvl.description}
                </span>

                {isCurrent && (
                  <span style={{
                    fontSize: '9px', color, background: `${color}15`,
                    borderRadius: '20px', padding: '1px 6px', flexShrink: 0,
                  }}>
                    Prochain
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
