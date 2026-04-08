const LEVEL_CONFIG = {
  beginner:     { label: 'Beginner',     color: '#64748b' },
  novice:       { label: 'Novice',       color: '#3b82f6' },
  rookie:       { label: 'Rookie',       color: '#10b981' },
  intermediate: { label: 'Intermediate', color: '#f59e0b' },
  master:       { label: 'Master',       color: '#f97316' },
  expert:       { label: 'Expert',       color: '#8b5cf6' }
};

export default function ProficiencyBadge({ level }) {
  const cfg = LEVEL_CONFIG[level] || LEVEL_CONFIG.beginner;
  return (
    <span className="proficiency-badge" style={{ backgroundColor: cfg.color }}>
      {cfg.label}
    </span>
  );
}
