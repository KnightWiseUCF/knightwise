////////////////////////////////////////////////////////////////
//
//  Project:       KnightWise
//  Year:          2026
//  Author(s):     Daniel Landsman
//  File:          codeLimits.js
//  Description:   Config file used to set code submission limits
//                 Numbers may need fine-tuning
//
////////////////////////////////////////////////////////////////

// Maximum allowed size of submitted code, in bytes
const MAX_CODE_BYTES = 10000;

// Maximum allowed code submissions a day for an individual user
const MAX_SUBMISSIONS_PER_DAY = 50;

/*
 * Judge0 already enforces the following runtime and memory limits:
 *   cpu_time_limit :5
 *   memory_limit   :256000
 * Which can be found by calling the Get Configuration endpoint on RapidAPI.
 * Still, we may want to enforce our own limits. That's what these constants are for.
 * 
 * // Maximum allowed runtime of submitted code, in milliseconds 
 * const MAX_RUNTIME_MS = TBD
 *
 * // Maximum allowed runtime memory usage of submitted code, in kilobytes
 * const MAX_MEMORY_KB = TBD
 */

module.exports = {
    MAX_CODE_BYTES,
    MAX_SUBMISSIONS_PER_DAY,
    // MAX_RUNTIME_MS,
    // MAX_MEMORY_KB
}