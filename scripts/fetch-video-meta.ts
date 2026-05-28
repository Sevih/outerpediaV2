/**
 * Standalone runner for the video-meta pipeline step — handy for a manual or
 * forced refresh outside `npm run dev`:
 *
 *   npm run video-meta              # fetch only newly added IDs
 *   npm run video-meta -- --force   # refetch every ID
 *
 * The same logic runs automatically in the dev pipeline (pipeline/steps/video-meta).
 * Here a missing API key is fatal (you asked for it explicitly).
 */
import { run } from '../pipeline/steps/video-meta';

run({ force: process.argv.includes('--force'), required: true })
  .then((summary) => console.log(summary))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
