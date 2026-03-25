////////////////////////////////////////////////////////////////
//
//  Project:       KnightWise
//  Year:          2026
//  Author(s):     Daniel Landsman
//  File:          guildNames.js
//  Description:   Config file where word bank for generating
//                 guild names live.
//
////////////////////////////////////////////////////////////////

// A guild name is an adjective followed by a plural noun.
// i.e. "Speedy Hedgehogs"
// Feel free to add some more!
const guildNames = {
  adjectives: [
    "Ancient", "Blazing", "Crazy", "Diabolical", "Deprecated", "Eternal",
    "Fierce", "Golden", "Handy", "Iron", "Jade", "Lunar", "Mystic",
    "Noble", "Ornate", "Powerful","Radiant", "Recursive", "Sacred",
    "Speedy", "Twisted", "Undying", "Victorious",
  ],
  pluralNouns: [
    "Academics", "Astronauts", "Bookworms", "Bishops", "Crowns",
    "Dragons", "Diamonds", "Embers", "Fangs", "Guardians", "Hedgehogs",
    "Iguanas", "Jesters", "Knights", "Kings", "Legions",
    "Monsters", "Mainframes", "Networks", "Outlaws", "Phantoms",
    "Pawns", "Queens", "Rooks", "Serpents", "Titans", "Wolves",
  ],
};

module.exports = guildNames;
