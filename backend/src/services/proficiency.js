const config = require('../../config/config.json');

function getLevel(correctCount) {
  const levels = config.proficiency;
  for (const [level, range] of Object.entries(levels)) {
    const aboveMin = correctCount >= range.min;
    const belowMax = range.max === null || correctCount <= range.max;
    if (aboveMin && belowMax) {
      return level;
    }
  }
  return 'beginner';
}

module.exports = { getLevel };
