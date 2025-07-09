# Eleventy HTML Tag Templates Plugin

**Author:** David Yue  
**GitHub:** https://github.com/CoconutJJ/eleventy-html-tag-templates-plugin

Transform your Eleventy templates with custom HTML tags that expand into regular HTML during build time. Think of it as a lightweight, template-focused alternative to React JSX components.

## Why Use This Plugin?

While Eleventy's shortcodes excel at logic-heavy templates, HTML Tag Templates shine for markup and style-heavy components. This plugin makes it natural to add properties, classes, and IDs to your templates without the visual clutter that comes with repeated shortcode usage in HTML.

## Installation

You can install this package with `pnpm`

```sh
$ pnpm add eleventy-html-tag-templates
```

`npm` and `yarn` should work as well.

## Quick Start

Configure your `.eleventy.js` file:

```js
import { HTMLTagTemplates } from "eleventy-html-tag-templates";
import Nunjucks from "nunjucks";

export default function (eleventyConfig) {
  // Set up Nunjucks environment
  let nunjucksEnvironment = new Nunjucks.Environment(
    new Nunjucks.FileSystemLoader("src/_includes")
  );

  // Optional: Enable custom Nunjucks features from your Eleventy config
  eleventyConfig.setLibrary("njk", nunjucksEnvironment);

  const htmlTagTemplates = new HTMLTagTemplates();

  eleventyConfig.addPlugin(htmlTagTemplates.eleventyPlugin(), {
    tagTemplateDirectory: "path/to/templates/dir",
    nunjucksEnvironment: nunjucksEnvironment,
    styleSheetPreprocessor: (filepath) => {
      return readFileSync(filepath);
    },
  });
}
```

## Creating Tag Templates

### Basic Templates

Create a Nunjucks file in your templates directory. The filename becomes the tag name:

**File:** `button.njk`
```html
<button class="btn">{{ label }}</button>
```

**Usage:**
```html
<button label="Click me" />
```

### Custom Tag Names

Override the default tag name using frontmatter:

```html
---
tag: "PrimaryButton"
---
<button class="btn btn-primary">{{ label }}</button>
```

**Usage:**
```html
<PrimaryButton label="Submit" />
```

### Template Structure Rules

Each tag template must have exactly one root element:

**❌ Invalid - Multiple root elements:**
```html
<div class="left">{{ title }}</div>
<div class="right">{{ description }}</div>
```

**✅ Valid - Single root element:**
```html
<div class="container">
  <div class="left">{{ title }}</div>
  <div class="right">{{ description }}</div>
</div>
```

## Advanced Features

### Paired Tags with Content

Create templates that wrap content using the special `content` variable:

**Template:**
```html
---
tag: "Card"
---
<div class="card">
  <h2>{{ title }}</h2>
  <div class="card-body">{{ content }}</div>
</div>
```

**Usage:**
```html
<Card title="Welcome">
  <p>This content goes inside the card body.</p>
</Card>
```

### Integrated CSS Styling

Attach stylesheets directly to your templates:

```html
---
tag: "Hero"
stylesheet: "src/_includes/css/hero.css"
---
<section class="hero">
  <h1>{{ title }}</h1>
  <p>{{ subtitle }}</p>
</section>
```

The stylesheet automatically gets injected into the `<head>` of pages that use this template. Unused templates won't add unnecessary CSS to your pages.

### CSS Preprocessor Support

Use SASS, LESS, or other preprocessors by defining a custom processor function:

```js
// For SASS
eleventyConfig.addPlugin(htmlTagTemplates.eleventyPlugin(), {
  tagTemplateDirectory: "src/_templates",
  nunjucksEnvironment: nunjucksEnvironment,
  styleSheetPreprocessor: (filepath) => {
    return sass.renderSync({ file: filepath }).css.toString();
  },
});
```

## Attribute Forwarding

The plugin automatically forwards valid HTML attributes to your template's root element, making your templates more flexible without manual configuration.

### Basic Forwarding

**Template:**
```html
---
tag: "Link"
---
<a href="#">{{ content }}</a>
```

**Usage:**
```html
<Link href="/about" target="_blank">About Us</Link>
```

**Result:**
```html
<a href="/about" target="_blank">About Us</a>
```

### Attribute Validation

Only valid HTML attributes for the root element are forwarded:

```html
<!-- ✅ 'style' is valid for div -->
<MyDiv style="color: red;" title="Valid title" />

<!-- ❌ 'customProp' becomes a template variable, not an attribute -->
<MyDiv customProp="value" />
```

### Class and ID Merging

The `class` and `id` attributes get special treatment - they merge instead of overwriting:

**Template:**
```html
---
tag: "Button"
---
<button class="btn" id="base">{{ label }}</button>
```

**Usage:**
```html
<Button class="btn-primary" id="submit-btn" label="Submit" />
```

**Result:**
```html
<button class="btn btn-primary" id="base submit-btn">Submit</button>
```

### Attribute Override Behavior

Template attributes are overridden by usage attributes (except `class` and `id`):

**Template:**
```html
<a href="#default">Default Link</a>
```

**Usage:**
```html
<MyLink href="/custom">Custom Link</MyLink>
```

**Result:**
```html
<a href="/custom">Custom Link</a>
```

## Configuration Options

| Option | Type | Description |
|--------|------|-------------|
| `tagTemplateDirectory` | string | Path to your tag template files |
| `nunjucksEnvironment` | Nunjucks.Environment | Nunjucks environment for rendering |
| `styleSheetPreprocessor` | function | Optional CSS preprocessor function |

## Best Practices

1. **Keep templates focused** - Each template should represent a single, reusable component
2. **Use semantic filenames** - Template filenames should clearly indicate their purpose
3. **Leverage CSS integration** - Colocate styles with templates for better maintainability
4. **Take advantage of attribute forwarding** - Design templates to work naturally with standard HTML attributes
5. **Consider template composition** - Use paired tags to create flexible, composable components

## Example: Complete Component

**File:** `src/_templates/alert.njk`
```html
---
tag: "Alert"
stylesheet: "src/_includes/css/alert.css"
---
<div class="alert alert-{{ type || 'info' }}" role="alert">
  {% if title %}
    <h4 class="alert-title">{{ title }}</h4>
  {% endif %}
  <div class="alert-content">{{ content }}</div>
</div>
```

**Usage:**
```html
<Alert type="warning" title="Important Notice" class="mb-4">
  Please review the terms before proceeding.
</Alert>
```

This creates a flexible, styled alert component that integrates seamlessly with your existing HTML and CSS workflow.