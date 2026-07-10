// Shared representative photos (Wikimedia Commons) for each planet body, so
// planets.mjs (oppositions/elongations) and conjunctions.mjs can both use a
// consistent image per body without duplicating URLs.
export const PLANET_IMAGES = {
  Mercury: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/3/30/Mercury_in_color_-_Prockter07_centered.jpg',
    credit: 'NASA/JHUAPL/CIW, Wikimedia Commons',
  },
  Venus: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/8/85/Venus_globe.jpg',
    credit: 'NASA/JPL, Wikimedia Commons',
  },
  Mars: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/7/76/Mars_Hubble.jpg',
    credit: 'NASA/ESA/Hubble, Wikimedia Commons',
  },
  Jupiter: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/7/71/PIA22946-Jupiter-RedSpot-JunoSpacecraft-20190212.jpg',
    credit: 'NASA/JPL-Caltech/SwRI/MSSS, Wikimedia Commons',
  },
  Saturn: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/e/e3/Saturn_from_Cassini_Orbiter_%282004-10-06%29.jpg',
    credit: 'NASA/JPL/Space Science Institute, Wikimedia Commons',
  },
  Uranus: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/8/8b/Uranus_from_Voyager_2.jpg',
    credit: 'NASA/JPL, Wikimedia Commons',
  },
  Neptune: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/5/56/Neptune_Full.jpg',
    credit: 'NASA/JPL, Wikimedia Commons',
  },
}
