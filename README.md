# High Peak & Marple Snooker League

Public 2026–27 website, hosted by GitHub Pages at https://highpeakandmarplesnookerleague.co.uk.

The league table, approved results, merit rankings and handicaps load from the league’s Supabase service. All 35 reviewed matches through 11 November have been imported. Captain and administrator logins use the existing league accounts. Public visitors can browse without signing in.

The Knockouts tab contains Handicap Singles, Sonya Lee, Legends and Doubles. Confirmed winners advance automatically through the displayed draw. Administrators record subsequent results after signing in. Byes advance without creating a played result; passing a deadline does not decide a winner.

The previous website and public data remain under seasons/2025-26. The existing CNAME and historical PDF archive are retained. A custom 404 page preserves known extensionless captain and administration URLs, including authentication fragments.

This repository contains the public website only. Original source draw PDFs, reconciliation reports, import working data, setup scripts and private notes remain on the owner-only test site and are excluded from this release. Database and account-management permissions are enforced on the server; browser configuration contains only the public project URL and publishable key.
