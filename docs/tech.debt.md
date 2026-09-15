frontend lib
================

custom elements [lit.dev](https://lit.dev/)
with template syntax like jade/pug for html.
and stylus/sass syntax for css.

should include vscode syntax highlight extension


1. indentation parser (like pyton)
2. should work with html nodes
3. should work with node attributes
4. should work with code blocks



```pug
body
    //- stylus/sass like syntax for css

    fg=0x555555
    bg=0xffffff

    style
        body
            color       $fg
            background  $bg
            font        14px/1.5 ui-monospace, 'SF Mono', monospace
            padding     1rem
            height      100vh
            shadow      0 0 6px rgba(51, 255, 102, .35)

        h2
            color     $fg      ; font-size 12px
            letter-spacing .2em; margin-bottom  .5rem

            &::before
                content '── '

            &::after
                content ' ──'

    header
        h1.brand theseus

    main#auth.auth
        h2 DOCKING CLEARANCE

        input#handle(required   type=text     placeholder=handle   autocomplete=username)
        input#password(required type=password placeholder=password autocomplete=current-password)

        input#id(
            name=id
            type=text
            required
        )

        select#list
        -
            const list = [ 'uno', 'dos', 'tres' ]


        each x of list
            option(value=$x) $i $x

        ul
            each i, x of list
                li.index-#{i} x

        button#login LOGIN
        button#register REGISTER

        p.auth-msg

    main#game

        section.wallet
            h2 wallet
            div.wallet-body
                p.money ₢3912.02
                p.dim Alice

        section.ship
            h2 ship
            div.ship-body
                p "nostromo"
```