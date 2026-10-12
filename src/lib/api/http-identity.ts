/**
 * The User-Agent every outbound call to a shared public service (Nominatim,
 * Overpass, Wikipedia) must send. OSMF and Wikimedia policies ask for an app
 * name plus a way to reach the operator; set `APP_CONTACT` (an email or a URL)
 * in the server environment. Without it the string says so, which is visible
 * to the service operator and not silently anonymous.
 */
export function appUserAgent(): string {
  const contact = process.env.APP_CONTACT?.trim() || "contact-not-configured";
  return `HikingRoutePlanner/1.0 (contact: ${contact})`;
}
