# Kindred Co-op sample demo

- URL: <https://kindred-coop.sociobot.in/demo>
- Entry: choose **Try it with sample data** on the first screen.
- Sample: both roles in the free four-shape puzzle. Moon and Leaf start matched,
  and Star is waiting for the matcher. The visitor can finish Star and Ripple.
- Reset: **Reset demo** restores the populated two-of-four state.
- Exit: **Start for real** removes sample progress before opening room creation.
- Isolation: sample progress uses only the `demo:kindred-coop` session-storage
  key. Demo startup does not read license or room keys, call room APIs, create a
  server room, or increment the aggregate page count. Closing the browser
  session removes the sample namespace.
