---
status: accepted
---

# Isolate the admin planner as a React application

Keep the public invitation as its existing static HTML, CSS, and JavaScript,
but build `/admin` as an isolated Vite and React application deployed with the
same Netlify site. The admin planner's drag-and-drop interactions, realtime
state, validation, immutable publication workflow, and future visual Floor Plan
justify a stateful application boundary without forcing a rewrite of the
working public invitation.
