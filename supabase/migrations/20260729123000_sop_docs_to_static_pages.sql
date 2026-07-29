-- Portal sweep 2026-07-29: three SOP docs became styled static pages
-- (/sops/simple-discovery-framework, /sops/objection-handling-playbook,
-- /sops/objection-think-about-it — content ported verbatim into the repo);
-- their DB rows retire and old /knowledge/<slug> links redirect in-app.
-- Also: the one Grow Acquisition branding line in World-Class Client
-- Delivery Systems rewrites to ISA framing (founder: "that's for me").
DELETE FROM public.docs WHERE slug IN (
  'simple-discovery-framework-phone-setters',
  'objection-handling-playbook',
  'objection-think-about-it'
);
UPDATE public.docs
SET content = replace(
  content,
  'Case Study: Grow Acquisition scaled from $20K to $170K per month in profit by creating bulletproof delivery systems.',
  'The standard: bulletproof delivery systems are what let an academy scale from $20K to $170K per month in profit without churn eating the growth.'
)
WHERE slug = 'world-class-client-delivery-systems';
