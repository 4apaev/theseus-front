import js               from '@eslint/js'
import gb               from 'globals'
import tslint           from 'typescript-eslint'
import stylistic        from '@stylistic/eslint-plugin'
import { defineConfig } from 'eslint/config'

import rules            from './scripts/eslint.rules.js'

// preserve the shared rule options; use maintained, typescript-aware formatters.
const renamed = {
    'func-call-spacing': 'function-call-spacing',
}
const styleRules = Object.fromEntries(Object.entries(rules).map(([ name, setting ]) => {
    const replacement = renamed[ name ] ?? name
    return [ stylistic.rules[ replacement ] ? `@stylistic/${ replacement }` : name, setting ]
}))

// stylistic uses explicit strings for the same template-literal preference.
if (typeof rules.quotes[ 2 ].allowTemplateLiterals === 'boolean') {
    styleRules[ '@stylistic/quotes' ] = [ rules.quotes[ 0 ], rules.quotes[ 1 ], {
        ...rules.quotes[ 2 ],
        allowTemplateLiterals: rules.quotes[ 2 ].allowTemplateLiterals ? 'always' : 'never',
    }]
}

// extension rules understand typescript syntax while retaining the same policy.
const extensions = [ 'class-methods-use-this', 'max-params', 'no-unused-vars', 'no-useless-constructor' ]
const tsRules = { ...styleRules, 'no-undef': 0 }
for (const name of extensions) {
    tsRules[ name ] = 0
    tsRules[ `@typescript-eslint/${ name }` ] = name === 'max-params'
        ? [ rules[ name ][ 0 ], { max: rules[ name ][ 1 ] }]
        : rules[ name ]
}

export default defineConfig([
    {
        ignores: [ 'dist/**', 'node_modules/**', 'scripts/eslint.rules.js' ],
    },
    {
        files: [ '**/*.{js,ts}' ],
        extends: [ js.configs.recommended ],
        plugins: { '@stylistic': stylistic },
        languageOptions: { globals: gb.node },
        rules: styleRules,
    },
    {
        files: [ 'src/**/*.{js,ts}' ],
        languageOptions: { globals: gb.browser },
    },
    {
        files: [ '**/*.ts' ],
        extends: [ ...tslint.configs.recommended ],
        // tsc owns name resolution; eslint's no-undef cannot resolve type names.
        rules: tsRules,
    },
])
