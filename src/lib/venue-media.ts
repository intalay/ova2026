import enercarePhoto from '@/assets/enercare-official.jpg.asset.json';

/** Only exact venue matches may reuse source-checked photography. */
export function venueMedia(name: string) {
  if (name !== 'Enercare Centre') return null;
  return {
    url: enercarePhoto.url,
    alt: 'Enercare Centre exterior — photo from Exhibition Place',
    source: 'https://www.explace.on.ca/venue/enercare-centre/',
  };
}