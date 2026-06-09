const fs = require("fs");
const path = require("path");

const config = {
  SUPABASE_URL: process.env.SUPABASE_URL || "https://blbmdnygvoqyrovvlrrh.supabase.co",
  SUPABASE_PUBLISHABLE_KEY:
    process.env.SUPABASE_PUBLISHABLE_KEY || "sb_publishable_VmOfhSgbzTW-iNZNMdlUww_nfAO5C86",
};

const target = path.join(__dirname, "..", "config.js");
const content = `window.WORKCHECK_CONFIG = ${JSON.stringify(config, null, 2)};\n`;

fs.writeFileSync(target, content, "utf8");
