////////////////////////////////////////////////////////////////
//
//  Project:       KnightWise
//  Year:          2026
//  Author(s):     Daniel Landsman
//  File:          analyticsModel.js
//  Description:   KnightWise analytics engine.
//                 Computes a weighted performance metric
//                 (0.0 - 1.0) per response.
//
//  Dependencies:  analyticsConfig
//                 validationUtils
//
////////////////////////////////////////////////////////////////

const {
        WEIGHT_ACCURACY,
        WEIGHT_TIME,
        WEIGHT_SUBCATEGORY,
        WEIGHT_TYPE,
        SUBCATEGORY_DIFFICULTY,
        TYPE_DIFFICULTY,
        MAX_ELAPSED_TIME_SECONDS,
        DEFAULT_DIFFICULTY,
      } = require('../../shared/analyticsConfig');
const { normalizeDBString } = require('../utils/validationUtils');

/**
 * Computes a weighted performance metric for a single response
 * Result is a value from 0.0 to 1.0, higher is better
 *
 * NOTE: Point value is intentionally excluded here. It is applied at aggregation
 *       time w/ computeWeightedTopicMetric so that higher-point questions
 *       influence topic ranking more without breaking the 0-1 per-response bound.
 * 
 * Component breakdown:
 *   - Accuracy:    normalizedScore (points_earned / points_possible)
 *   - Time:        1 - (elapsedTime / MAX_ELAPSED_TIME_SECONDS), clamped to [0, 1]
 *                  Null elapsed time uses neutral score of 0.5
 *   - Subcategory: difficulty scalar from analyticsConfig
 *   - Type:        difficulty scalar from analyticsConfig
 *
 * @param {Object}      response                  - Question response to compute metric for
 * @param {number}      response.normalizedScore  - Points earned / points possible (0-1)
 * @param {number|null} response.elapsedTime      - Seconds taken to answer, or null
 * @param {string}      response.subcategory      - Question.SUBCATEGORY string
 * @param {string}      response.type             - Question.TYPE string
 * @returns {number} Performance metric, 0.0 to 1.0
 */
const computePerformanceMetric = ({ normalizedScore, elapsedTime, subcategory, type }) => {
  // Accuracy component: most heavily weighted
  const accuracyScore = Math.max(0, Math.min(1, normalizedScore));

  // Time component: clamp to [0,1], use neutral 0.5 if null
  const timeScore = (elapsedTime == null)
    ? 0.5
    : 1 - Math.min(1, elapsedTime / MAX_ELAPSED_TIME_SECONDS);

  // Subcategory and type difficulty scalars
  const subcategoryScore = SUBCATEGORY_DIFFICULTY[normalizeDBString(subcategory ?? '')] ?? DEFAULT_DIFFICULTY;
  const typeScore        = TYPE_DIFFICULTY[normalizeDBString(type ?? '')]               ?? DEFAULT_DIFFICULTY;

  return (
    WEIGHT_ACCURACY    * accuracyScore    +
    WEIGHT_TIME        * timeScore        +
    WEIGHT_SUBCATEGORY * subcategoryScore +
    WEIGHT_TYPE        * typeScore
  );
};

/**
 * Computes a point-weighted average metric for a topic
 * Higher point value responses contribute more to the topic score,
 * naturally making higher-point questions more influential in ranking.
 *
 * @param {number[]} metrics     - Per-response performance metrics (0-1)
 * @param {number[]} pointValues - Corresponding pointsPossible for each response
 * @returns {number} Weighted average metric, 0.0 to 1.0, or 0 if empty
 */
const computeWeightedTopicMetric = (metrics, pointValues) => {
  if (!metrics || metrics.length === 0) return 0;
  const totalWeight = pointValues.reduce((sum, p) => sum + p, 0);
  const weightedSum = metrics.reduce((sum, m, i) => sum + m * pointValues[i], 0);
  return totalWeight > 0 ? weightedSum / totalWeight : 0;
};

/**
 * Computes a median value from an array of numbers.
 * Returns null for empty arrays.
 *
 * @param {number[]} values - Data set
 * @returns {number|null}   - Median
 */
const computeMedian = (values) => {
  if (!values || values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
};

module.exports = {
  computePerformanceMetric,
  computeWeightedTopicMetric,
  computeMedian,
};
