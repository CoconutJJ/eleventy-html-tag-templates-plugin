import * as cheerio from "cheerio";
import { readFileSync, statSync, readdirSync } from "fs";
import { join } from "path";
import { Environment as NunjucksEnvironment } from "nunjucks";
import matter from "gray-matter";
import { htmlElementAttributes } from "html-element-attributes";

export type HTMLTagTemplatesOptions = {
  tagTemplateDirectory: string;
  nunjucksEnvironment: NunjucksEnvironment;
  styleSheetPreprocessor: (filepath: string) => string;
};

export class HTMLTagTemplates {
  private config: HTMLTagTemplatesOptions;
  private templates: { [key: string]: string } = {};

  constructor(config: HTMLTagTemplatesOptions) {
    this.config = config;
  }

  private process_template_directory(template_directory: string) {
    let template_files = readdirSync(template_directory);

    for (let filename of template_files) {
      if (!filename.endsWith(".html") && !filename.endsWith(".njk")) continue;

      let full_path = join(template_directory, filename);

      // process templates in subdirectories recursively
      if (statSync(full_path).isDirectory()) {
        this.process_template_directory(full_path);
        continue;
      }

      let template_content = readFileSync(full_path).toString();

      let file_stem = filename.split(".")[0];

      this.add_template(template_content, file_stem);
    }
  }

  public add_template(template: string, default_tag_name: string) {
    const { data } = matter(template);

    if ("tag" in data) {
      if (data["tag"] in this.templates) {
        throw new Error(`There is already a tag template named ${data["tag"]}`);
      }
      this.templates[data["tag"]] = template;
    } else {
      if (default_tag_name in this.templates) {
        throw new Error(`Inferred tag name ${default_tag_name} already exists`);
      }
      this.templates[default_tag_name] = template;
    }
  }

  private forward_html_attributes(
    html_content: string,
    attributes: { [key: string]: string }
  ) {
    const expanded_template = cheerio.load(html_content, {}, false);

    if (expanded_template.root().children().length > 1) {
      throw new Error("Template definition must have only one top level tag");
    }

    let top_element = expanded_template.root().children()[0];

    // if the tag attribute is a valid attribute for the top level, forward it onto the tag
    for (let [attr, value] of Object.entries(attributes)) {
      // if the top element is another tag template, we forward all attributes
      if (!(top_element.name in this.templates)) {
        let exclusiveAttributes =
          top_element.name in htmlElementAttributes
            ? htmlElementAttributes[top_element.name]
            : [];

        let allowed_attributes = exclusiveAttributes.concat(
          htmlElementAttributes["*"]
        );
        if (allowed_attributes.indexOf(attr) == -1) {
          continue;
        }
      }
      if (attr === "class") {
        if ("class" in top_element.attribs) {
          value = value
            .split(" ")
            .concat(top_element.attribs["class"])
            .join(" ");
        }
      }
      if (attr === "id") {
        if ("id" in top_element.attribs) {
          value = value
            .split(" ")
            .concat(top_element.attribs["class"])
            .join(" ");
        }
      }

      top_element.attribs[attr] = value;
    }

    return expanded_template.html();
  }

  public recursive_transform(html_content: string) {
    let processed_tags = new Set<string>();
    let template_css = "";

    while (true) {
      let { html, css, transformed } = this.transform(
        html_content,
        processed_tags
      );
      html_content = html;
      template_css += css;
      if (!transformed) break;
    }

    const $ = cheerio.load(html_content);

    // try to find an existing style tag to inject the css into
    let headStyleChildren = $("head").children("style");

    // create a new style tag if no existing one is found
    if (headStyleChildren.length == 0) {
      $("head").append(`<style>${template_css}</style>`);
      return;
    }

    // find the first style tag and inject
    let styleTag = headStyleChildren[0];
    let existingStyleContent = $(styleTag).html();
    $(styleTag).html(
      existingStyleContent == null ? "" : existingStyleContent + template_css
    );

    return $.html();
  }

  public transform(html_content: string, processed_tags: Set<string>) {
    const $ = cheerio.load(html_content);
    let template_css = "";
    let did_transform = false;
    for (let [tag, template] of Object.entries(this.templates)) {
      const { content, data } = matter(template);

      let has_tag = false;
      let _this = this;

      $(tag).each(function () {
        has_tag = true;
        did_transform = true;
        let $el = $(this);
        let attributes = $el.attr();

        // render the template definition
        let expansion = _this.config.nunjucksEnvironment.renderString(content, {
          ...attributes,
          content: $el.html(),
        });

        // forward attributes
        if (attributes !== undefined) {
          expansion = _this.forward_html_attributes(expansion, attributes);
        }

        // replace tag template with expansion
        $el.replaceWith(expansion);
      });

      if (!("stylesheet" in data)) {
        continue;
      }

      if (!has_tag) {
        continue;
      }

      if (processed_tags.has(tag)) {
        continue;
      }

      let stylesheet_path = data["stylesheet"];
      template_css += this.config.styleSheetPreprocessor(stylesheet_path);
      processed_tags.add(tag);
    }
    return { html: $.html(), css: template_css, transformed: did_transform };
  }

  public eleventyPlugin() {
    return (eleventyConfig: any, pluginOptions: HTMLTagTemplatesOptions) => {
      this.config = pluginOptions;
      this.process_template_directory(this.config.tagTemplateDirectory);
      eleventyConfig.addTransform(
        "html-tag-templates-transform",
        (content: string, outputPath: string) => {
          if (!outputPath.endsWith(".html")) {
            return content;
          }
          return this.recursive_transform(content);
        }
      );
    };
  }
}
