// Deployment settings. The GitHub Pages workflow overwrites EWRA_MODE with "demo".
window.EWRA_MODE = "server"; // "server" = Node API + database; "demo" = browser-only with sample data
window.EWRA_BRAND = {
  product: "Entity-Wide Risk Assessment",
  org: "Group Compliance · Head Office, Amman",
  logo: "", // e.g. "assets/logo.svg" – place the bank's official logo file in public/assets/
};
