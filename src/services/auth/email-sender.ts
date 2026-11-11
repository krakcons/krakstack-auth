export const brandingEmailSender = ({
  name,
  domain,
  fallbackName,
}: {
  readonly name: string;
  readonly domain: string;
  readonly fallbackName: string;
}) => ({
  from: `noreply@${domain}`,
  fromName:
    name.replace(/[\r\n]/g, "").trim() ||
    fallbackName.replace(/[\r\n]/g, "").trim() ||
    "Krakstack Auth",
});
