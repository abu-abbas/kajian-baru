---
name: monorepo-setup
description: Sets up a pnpm workspaces monorepo with TypeScript. Use when initializing a new project or adding a new app/package to the monorepo.
---

# Monorepo Setup Skill

## Structure to create
```
kajian-baru/
├── apps/
│   ├── api/
│   └── web/
├── packages/
│   ├── parser/
│   └── types/
├── package.json
├── pnpm-workspace.yaml
└── tsconfig.base.json
```

## Steps

### 1. Root package.json
```json
{
  "name": "kajian-baru",
  "private": true,
  "scripts": {
    "dev": "pnpm --parallel dev",
    "build": "pnpm --recursive build",
    "typecheck": "pnpm --recursive typecheck"
  },
  "devDependencies": {
    "typescript": "^5.4.0"
  }
}
```

### 2. pnpm-workspace.yaml
```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

### 3. tsconfig.base.json
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "skipLibCheck": true
  }
}
```

### 4. Each package/app needs its own tsconfig.json that extends base:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist"
  },
  "include": ["src"]
}
```

### 5. Internal package references use workspace protocol:
```json
"dependencies": {
  "@kajian-baru/types": "workspace:*",
  "@kajian-baru/parser": "workspace:*"
}
```

## After setup
Run `pnpm install` from root to link all workspaces.
