import common from "./common.json";
import marketing from "./marketing.json";
import nav from "./nav.json";
import placeholder from "./placeholder.json";
import screens from "./screens.json";
import settings from "./settings.json";
import shell from "./shell.json";
import states from "./states.json";

/** English is the source of truth; every other locale must match its shape. */
const messages = { common, shell, nav, marketing, screens, placeholder, states, settings };

export type Messages = typeof messages;
export default messages;
