# Interactive event image framing

## Approach
Use a generated crop rather than database crop metadata. The editor will create a new optimized 16:10 image and keep using the existing `image_url` field. This avoids a schema change, makes the crop consistent across event cards, event details, featured sections, maps, and social previews, and adds no rendering work for visitors.

## Changes
- Add an interactive 16:10 crop frame to the Edit Event image field after either file upload or URL entry.
- Support drag/pan, wheel and pinch zoom, a visible zoom slider, and a Reset control.
- Add an Apply Crop action that generates the framed image and sends it through the existing image optimizer/storage flow; the normal Save Event action then persists that resulting URL.
- For pasted URLs, first copy valid external images into app storage so cropping works reliably and does not depend on third-party browser restrictions.
- Keep replace/remove behavior and clear progress/error feedback while an image is prepared or cropped.
- Update the image optimizer to safely accept generated crop uploads while retaining its existing size and JPEG optimization behavior.

## Technical details
- Add `react-easy-crop` for accessible drag, pinch, wheel, and crop calculations.
- Use the live site’s existing `16 / 10` image ratio.
- Create the crop in the browser canvas, then upload the result through `optimize-image`; no new database columns are needed.
- Limit the cropper to the Edit Event panel so the requested change does not alter unrelated creation/import workflows.

## Validation
- Verify uploaded-file and pasted-URL flows, zoom, drag, Reset, Apply Crop, and Save Event.
- Confirm the saved image renders with matching framing on both an event card and event detail page at desktop and mobile sizes.
- Run focused tests and check browser console/network errors during the full edit flow.
