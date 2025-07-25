# Deployment Guide

This guide explains how to deploy your WebAssembly Space Shooter Game using GitHub Actions and GitHub Pages.

## Automatic Deployment with GitHub Actions

### Prerequisites

1. **Push your code to GitHub** in a repository
2. **Enable GitHub Pages** in your repository settings

### Setup GitHub Pages

1. Go to your repository on GitHub
2. Click **Settings** → **Pages**
3. Under **Source**, select **Deploy from a branch**
4. Choose **gh-pages** branch and **/(root)** folder
5. Click **Save**

### How the Workflow Works

The GitHub Actions workflow (`.github/workflows/build-and-deploy.yml`) will:

1. **Trigger** on every push to `main` branch
2. **Setup** Node.js 18 and Rust with WebAssembly target
3. **Install** wasm-pack for WebAssembly compilation
4. **Build** the WebAssembly module (`npm run build:wasm`)
5. **Build** the production application (`npm run build`)
6. **Deploy** to GitHub Pages automatically

### Workflow Files

- **`build-and-deploy.yml`** - Full build and deploy to GitHub Pages
- **`build.yml`** - Build only (for testing and PRs)

## Manual Deployment

If you prefer to deploy manually:

```bash
# Build the project
npm run build:wasm
npm run build

# The dist/ folder contains your deployable files
# Upload dist/ to any static hosting service
```

## Hosting Options

### GitHub Pages (Recommended)

- **Free** hosting
- **Automatic HTTPS**
- **Custom domains** supported
- **Integrated** with GitHub Actions

### Other Static Hosting Services

#### Netlify

1. Run `npm run build`
2. Drag `dist/` folder to Netlify
3. Get instant HTTPS URL

#### Vercel

1. Connect your GitHub repository
2. Vercel automatically detects and builds
3. Deploys on every push

#### Firebase Hosting

```bash
npm install -g firebase-tools
firebase login
firebase init hosting
firebase deploy
```

## Environment Variables

No environment variables are needed for this project since it's a client-side only application.

## Custom Domain

To use a custom domain:

1. **Add CNAME file** to your repository
2. **Configure DNS** to point to your GitHub Pages URL
3. **Update workflow** to include your domain:

```yaml
- name: Deploy to GitHub Pages
  uses: peaceiris/actions-gh-pages@v3
  with:
    github_token: ${{ secrets.GITHUB_TOKEN }}
    publish_dir: ./dist
    cname: yourdomain.com
```

## Troubleshooting

### Build Fails

- Check that Rust and wasm-pack are properly installed
- Verify all dependencies are in `package.json`
- Check the GitHub Actions logs for specific errors

### Deployment Fails

- Ensure GitHub Pages is enabled in repository settings
- Check that the `gh-pages` branch is created
- Verify the workflow has proper permissions

### Game Doesn't Load

- Check browser console for WebAssembly loading errors
- Ensure all files are properly built in `dist/`
- Verify HTTPS is used (WebAssembly requires secure context)

## Performance Optimization

The build process includes:

- **WebAssembly optimization** with `wasm-opt`
- **Code splitting** and tree shaking
- **Asset compression** and caching
- **Modern JavaScript** targeting

## Security

- **WebAssembly** runs in a secure sandbox
- **No server-side code** means no server vulnerabilities
- **HTTPS required** for WebAssembly in production
- **Content Security Policy** can be added for additional security
