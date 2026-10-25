style guide
================

## laconia 🫡

try to be laconic as possible (code writing, or any response from you).
i still need to read all this code,
i am only a human, english even not my second language.
so optimize, each line can be last straw 😵‍💫 (i know, we're building a game, and that involves writing code 🧐).

## html

this is not some app when developers trying to obfuscate or hide from scrappers.
do not use `div` or `span` for everything.

use clean html semantics:

`i` for italic
`s` for small
`b` for bold
`q` for quote
etc...

no generated ids & classes, god forbid.

## reusable components

ui elements like `buttons`, `menus`, `dropdowns`, `tabs`, `panels`, etc
should be game components.

use elements as if you don't have enough of them,
`div` and `span` scarcity is real)

avoid nested wrappers bearing no clear semantics or functionality.
avoid snake case in attribute names, prefer single word attrs.

## css

reusable classes:

prefer selectors by nesting - `.atlas-map-heading` -> `.atlas .map .heading`
avoid magic numbers - `0.4375rem` ->  prefer clean fractions of `0.5em` `1.25rem` etc.

align values by colon.
group props by context: decoration, position, dimension, etc.

```css
.atlas .map .heading {
    top           : 0;
    left          : 0;
    z-index       : 1;
    position      : absolute;
    pointer-events: none;

    & [data-kicker] { margin-bottom: .5rem }
    & h2 { color: var(--cream); font-size : 1.5rem }
    & p  { color: var(--muted); margin-top: 0.5rem }
}
```
## typograpy

main family is `SF`

1. sf mono
4. sf pro display
5. sf pro rounded

each line-height is vital; font hierarchy and consistency are paramount.
it should resemble an impeccable print akin to a rare book,
a fantasy of a lifelong bibliophile,
a King James first edition bible,
a כֶּתֶר אֲרַם צוֹבָא


| rem     |  px |    tag   |   font         | weight   |
|---------|-----|----------|----------------|----------|
| 0.625   |  10 | s, small | sf mono        | light    |
| 0.75    |  12 | body     | sf mono        | regular  |
| 0.875   |  14 | h6       | sf pro rounded | medium   |
| 1       |  16 | h5       | sf pro rounded | medium   |
| 1.125   |  18 | h4       | sf pro rounded | semibold |
| 1.25    |  20 | h3       | sf pro rounded | semibold |
| 1.5     |  24 | h2       | sf pro display | bold     |
| 2       |  32 | h1       | sf pro display | heavy    |


## todo

### 1. router
game needs a router - each refresh throws player out of his current screen to the main view