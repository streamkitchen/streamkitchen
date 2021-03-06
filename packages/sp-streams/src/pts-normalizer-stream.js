import mpegMungerStream, { streamIsVideo } from "./mpeg-munger-stream";
import debug from "debug";

/**
 * Whatever mpegts streams you pipe to it, the output will consistently increase in the way you'd
 * expect it to. Neato! For now assumes a 60/90000 timebase, which from my basic experimentation
 * seems like a pretty reasonable assumption.
 *
 * You should usually call me with source.pipe(ptsNormalizer, {end: false})
 */

const log = debug("sp:pts-normalizer-stream");
const TBN = 60;
const TBD = 90000;
const oneFramePts = TBD / TBN;

export default function ptsNormalizerStream() {
  const mpegMunger = mpegMungerStream();
  let ptsOut = 0;
  let offset = 0;
  let renormalize = false;
  mpegMunger.on("pipe", source => {
    log("New stream provided, renormalizing");
    source.on("end", () => mpegMunger.unpipe(source));
    // A new stream! Okay cool. When we first see a video pts, let's adjust everything to that.
    renormalize = true;
  });
  mpegMunger.on("end", () => {
    throw new Error("MAYDAY: mpegmunger ended somehow");
  });
  mpegMunger.transformPTS = pts => {
    if (renormalize === true) {
      offset = ptsOut - pts + oneFramePts;
      renormalize = false;
    }
    return pts + offset;
  };
  mpegMunger.transformDTS = dts => {
    return dts + offset;
  };
  return mpegMunger;
}
