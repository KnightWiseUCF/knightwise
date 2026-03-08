////////////////////////////////////////////////////////////////
//
//  Project:       KnightWise
//  Year:          2026
//  Author(s):     Daniel Landsman
//  File:          itemConfig.js
//  Description:   Shared config file for defining store item
//                 types, limits, and other constants.
//
//  Note:          This file is intentionally .js rather than .ts,
//                 for CommonJS compatibility with our backend Jest. 
//                 To make this .ts, the backend Jest would need to 
//                 be configured with ts-jest or similar.
//
////////////////////////////////////////////////////////////////

// These strings MUST EXACTLY MATCH StoreItem.TYPE
// Keep in sync with ItemType in models.ts
const ITEM_TYPES = Object.freeze(
{
  FLAIR: 'flair',
  PROFILE_PICTURE: 'profile_picture',
});

const EQUIP_LIMITS = Object.freeze(
{
  [ITEM_TYPES.FLAIR]: 3, // Subject to change
  [ITEM_TYPES.PROFILE_PICTURE]: 1,
});

module.exports = {
  ITEM_TYPES,
  EQUIP_LIMITS,
};