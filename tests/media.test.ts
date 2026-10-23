import { parseMediaUrl, getSafeEmbedUrl, isDirectVideoUrl, isDirectImageUrl } from '../src/utils/mediaUrlHelper';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  } else {
    console.log(`✅ PASSED: ${message}`);
  }
}

async function runMediaTests() {
  console.log('--- Testing Victoria Lar Media URL Parser & Security Helper ---\n');

  // 1. YouTube standard URL
  const yt1 = parseMediaUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  assert(yt1.isValid === true, 'YouTube standard watch URL is valid');
  assert(yt1.mediaType === 'video', 'YouTube auto-detects as video');
  assert(yt1.provider === 'youtube', 'YouTube provider identified');
  assert(yt1.embedUrl === 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ', 'YouTube embed URL formatted correctly');
  assert(yt1.thumbnailUrl === 'https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg', 'YouTube thumbnail generated');

  // 2. YouTube short link (youtu.be)
  const yt2 = parseMediaUrl('https://youtu.be/dQw4w9WgXcQ?t=10');
  assert(yt2.isValid === true, 'youtu.be link is valid');
  assert(yt2.embedUrl === 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ', 'youtu.be generates embed URL');

  // 3. YouTube Shorts link
  const ytShorts = parseMediaUrl('https://www.youtube.com/shorts/dQw4w9WgXcQ');
  assert(ytShorts.isValid === true, 'YouTube Shorts URL is valid');
  assert(ytShorts.embedUrl === 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ', 'YouTube Shorts generates embed URL');

  // 4. Vimeo standard URL
  const vimeo = parseMediaUrl('https://vimeo.com/76979871');
  assert(vimeo.isValid === true, 'Vimeo standard URL is valid');
  assert(vimeo.mediaType === 'video', 'Vimeo auto-detects as video');
  assert(vimeo.provider === 'vimeo', 'Vimeo provider identified');
  assert(vimeo.embedUrl === 'https://player.vimeo.com/video/76979871', 'Vimeo embed URL formatted correctly');

  // 5. Google Drive view link (Image mode)
  const gDriveImg = parseMediaUrl('https://drive.google.com/file/d/1A2B3C4D5E6F7G8H9I0J/view?usp=sharing', 'image');
  assert(gDriveImg.isValid === true, 'Google Drive image URL is valid');
  assert(gDriveImg.provider === 'google-drive', 'Google Drive provider identified');
  assert(gDriveImg.streamUrl?.includes('1A2B3C4D5E6F7G8H9I0J') === true, 'Google Drive thumbnail stream URL generated');
  assert(gDriveImg.warning !== undefined, 'Google Drive emits public sharing warning');

  // 6. Google Drive view link (Video mode)
  const gDriveVid = parseMediaUrl('https://drive.google.com/file/d/1A2B3C4D5E6F7G8H9I0J/view', 'video');
  assert(gDriveVid.isValid === true, 'Google Drive video URL is valid');
  assert(gDriveVid.mediaType === 'video', 'Google Drive preserves video type');
  assert(gDriveVid.embedUrl === 'https://drive.google.com/file/d/1A2B3C4D5E6F7G8H9I0J/preview', 'Google Drive preview embed generated');

  // 7. Direct MP4 video file
  const directMp4 = parseMediaUrl('https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4');
  assert(directMp4.isValid === true, 'Direct MP4 URL is valid');
  assert(directMp4.mediaType === 'video', 'Direct MP4 auto-detects as video');
  assert(directMp4.isDirectVideo === true, 'Direct MP4 flagged as direct video');

  // 8. Direct WEBP image file
  const directImg = parseMediaUrl('https://storage.googleapis.com/victorialar-assets/suite-quarto.webp');
  assert(directImg.isValid === true, 'Direct WebP URL is valid');
  assert(directImg.mediaType === 'image', 'Direct WebP auto-detects as image');

  // 9. XSS / Script injection blocking
  const xssJs = parseMediaUrl('javascript:alert(1)');
  assert(xssJs.isValid === false, 'javascript: URL is rejected');

  const xssData = parseMediaUrl('data:text/html,<script>alert(1)</script>');
  assert(xssData.isValid === false, 'data:text/html is rejected');

  const emptyUrl = parseMediaUrl('');
  assert(emptyUrl.isValid === false, 'Empty URL is rejected');

  // 10. Helper functions
  assert(isDirectVideoUrl('https://cdn.example.com/tour.webm') === true, 'isDirectVideoUrl recognizes .webm');
  assert(isDirectImageUrl('https://cdn.example.com/fachada.png') === true, 'isDirectImageUrl recognizes .png');
  assert(getSafeEmbedUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ') !== null, 'getSafeEmbedUrl generates safe YouTube embed');

  console.log('\n🎉 All Media URL Parser & Security Helper tests passed successfully!\n');
}

runMediaTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
