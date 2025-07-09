# eleventy-html-tag-templates-plugin
Author: David Yue

HTML Tag Templates allow you to use custom HTML tags as parameterized templates
that expand into regular HTML after processing. It is like a very limited form
of React JSX.

### Why not use shortcodes?

Good question. Shortcodes are great for logic heavy templates where as this
plugin is good for markup/style heavy templates. It is also cumbersome to add
additional properties, class names, or ids onto a shortcode, whereas this plugin
allows you to do this naturally. To that end, shortcodes also look very ugly
when used very repeatedly in HTML code

## Getting Started

You should setup your `.eleventy.js` config file similar to what we have below

```js
import { HTMLTagTemplates } from "eleventy-html-tag-templates";
import Nunjucks from "nunjucks";

export default function (eleventyConfig) {
  // Create a new nunjucks environment, the eleventy-html-tag-templates-plugin
  // requires a nunjucks environment to render your tag templates.
  let nunjucksEnvironment = new Nunjucks.Environment(
    new Nunjucks.FileSystemLoader("src/_includes")
  );

  // This line is optional but if you omit it, your templates will not be able to
  // use any custom nunjucks related features defined in your eleventy config file (filters, shortcodes, etc.)
  eleventyConfig.setLibrary("njk", nunjucksEnvironment);

  const htmlTagTemplates = new HTMLTagTemplates();

  config.addPlugin(htmlTagTemplates.eleventyPlugin(), {
    tagTemplateDirectory: "path/to/templates/dir",
    nunjucksEnvironment: nunjucksEnvironment,
    styleSheetPreprocessor: (filepath) => {
      return readFileSync(filepath);
    },
  });
}
```

## How to define tag templates

In your templates directory create a new nunjucks file with the tag name. For
instance, `tag.njk` will map to `<tag/>`. The tag name defaults to the file
name, however if you wish to keep the filename but use a different name for the
actual tag itself, you can specify the tag name in the tag template front matter

The following example will define: `<Tag/>` instead of `<tag/>`

```html
---
tag: "Tag"
---

<div class="tag"></div>
```

Tag templates can also have attributes like regular HTML

```html
<Tag title="A cool tag" />
```

These attributes are passed as nunjucks variables in our tag template file. We
can access their values like such:

```html
---
tag: "Tag"
---

<div class="tag">{{ title }}</div>
```

Each tag template **can only have at most one top level HTML element**, called
the root element. Having two sibling elements without a common parent is not
allowed.

❌ Not allowed - we must wrap another HTML tag around these two `<div>` elements

```html
---
tag: "Tag"
---

<div class="tag-left">{{ title }}</div>
<div class="tag-right">{{ description }}</div>
```

✅ OK

```html
---
tag: "Tag"
---
<div class="tag">
  <div class="tag-left">{{ title }}</div>
  <div class="tag-right">{{ description }}</div>
</div>
```

## Paired Tag Templates

So far we have only seen self-closing tag templates, we can also have paired tag
templates like many of the regular HTML tags

```html
<Title subtitle="A cool tag">
    Hello World!
</Title>
```

Each template file is passed a special nunjucks variable called `content` that
contains the children of the tag. We can access the children in the template
definition as such:

```html
---
tag: "Title"
---
<div class="title">
  <div class="tag-left">{{ content }}</div>
  <div class="tag-right">{{ subtitle }}</div>
</div>
```


## CSS Styling and Preprocessors

We can also attach a stylesheet to a tag template using the `stylesheet` front
matter property. This property takes the filepath of the stylesheet.

```html
---
tag: "Tag"
stylesheet: "src/_includes/css/tag.css"
---

<div class="tag">
  <div class="tag-left">{{ title }}</div>
  <div class="tag-right">{{ description }}</div>
</div>
```

When you build your site, the linked stylesheet will be read and inserted into
the `<head>` section of the corresponding HTML page between `<style></style>`
tags. If a tag is not used in an HTML file, it's stylesheet will also not be
inserted.

### Preprocessors

If you wish to use CSS preprocessors like SASS or LESS for styling tag
templates, you can define a custom `styleSheetPreprocessor` function inside the
Eleventy plugin config object.

The function should take in the stylesheet `filepath: string` and return the
compiled CSS source code `string`. In the the sample config above, we are only
expecting regular `.css` files, hence we just read the file and return it's
contents

```js
  config.addPlugin(htmlTagTemplates.eleventyPlugin(), {
    tagTemplateDirectory: "path/to/templates/dir",
    nunjucksEnvironment: nunjucksEnvironment,
    styleSheetPreprocessor: (filepath) => {
      return readFileSync(filepath);
    },
  });
```

## Attribute Forwarding

We have seen how tag templates can have attributes just like regular HTML,
however sometimes we wish to add regular HTML attributes to a tag template like
`href`, `style`, etc. However, currently this means everytime we wish to add a
regular HTML attribute, we have to modify the template to support it. For
instance, if we wanted to use the `style` attribute, we would have to do this:

```html
---
tag: "Tag"
stylesheet: "src/_includes/css/tag.css"
---

<div class="tag" style="{{ style }}">
  <div class="tag-left">{{ title }}</div>
  <div class="tag-right">{{ description }}</div>
</div>
```

This is annoying and cumbersome to do for all your templates. Luckily, our
plugin automatically fowards any **valid attributes** to the **root element** of
the template definition. Attribute forwarding obeys the following rules:

1. The attribute being forwarded must be **valid**. A **valid attribute** is any
   attribute that the root element in your template definition could have in
   regular HTML. For instance, trying to forward the attribute named `apple` to
   a `<div>` will not work. Instead `apple` would become a regular template
   variable. Consider the following template definition:

    ```html
    ---
    tag: "Tag"
    stylesheet: "src/_includes/css/tag.css"
    ---

    <div>
    <div class="tag-left">{{ title }}</div>
    <div class="tag-right">{{ description }}</div>
    </div>
    ```

    and the following usage:
    ```html
    <Tag title="Hello" description="world" apple="pear"/>
    ```

    The correct expansion is 
    ```html
    <div>
    <div class="tag-left">Hello</div>
    <div class="tag-right">world</div>
    </div>
    ```

    Whereas, this is incorrect
    ```html
    <div apple="pear">
    <div class="tag-left">Hello</div>
    <div class="tag-right">world</div>
    </div>
    ```
    ❌ `apple` is not a recognized attribute for `div`.

    ✅ But using the `style` attribute will work:

    ```html
    <Tag title="Hello" description="world" style="width:100%;"/>
    ```
    generates

    ```html
    <div style="width:100%">
    <div class="tag-left">Hello</div>
    <div class="tag-right">world</div>
    </div>
    ```
2.  The attribute being forwarded will overwrite the same attribute defined in
    the tag template file should such attribute exist

    ```html
    ---
    tag: "Link"
    stylesheet: "src/_includes/css/link.css"
    ---

    <a href="#">This is a link</a>
    ```

    and usage:

    ```html
    <Link href="/hello"/>
    ```

    This will overwrite the existing `href` attribute, and will generate

    ```html
    <a href="/hello">This is a link</a>
    ```

    There are two HTML attributes that are exceptions to this rule: `class` and
    `id`. Specifying either of these attributes in both the tag template and the
    template definition root element will join the two attribute values
    together. This is especially useful for class lists:

    ```html
    ---
    tag: "Link"
    stylesheet: "src/_includes/css/link.css"
    ---

    <a href="#" class="a">{{ content }}</a>
    ```

    and usage:

    ```html
    <Link class="b">This is a link</Link>
    ```

    will generate
    ```html
    <a href="#" class="a b">This is a link</a>
    ```
