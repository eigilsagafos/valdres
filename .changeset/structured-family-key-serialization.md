---
"valdres": patch
---

Fix stable serialization for structured family keys that include Maps. Map
family arguments no longer throw from an undefined serializer helper, and Map
and Set arguments are serialized with stable tagged representations to avoid
ordering instability and collisions with plain objects or arrays.
