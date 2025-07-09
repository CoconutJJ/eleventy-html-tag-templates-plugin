import * as cheerio from "cheerio";
import { readFileSync, statSync, readdirSync } from "fs";
import { join } from "path";
import { Environment as NunjucksEnvironment } from "nunjucks";
import * as njk from "nunjucks";
import matter from "gray-matter";
import { htmlElementAttributes } from "html-element-attributes";
import { config } from "process";

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

  private process_template_directory() {
    let template_files = readdirSync(this.config.tagTemplateDirectory);

    for (let filename of template_files) {
      let full_path = join(this.config.tagTemplateDirectory, filename);

      if (statSync(full_path).isDirectory()) {
        continue;
      }

      let template_content = readFileSync(full_path).toString();

      let file_stem = filename.split(".")[0];

      this.templates[file_stem] = template_content;
    }
  }

  /**
   * Add a template content string
   * @param template_content Template
   */
  public add_template(template: string) {
    const { data } = matter(template);

    if (data["tag"] === undefined) {
      throw new Error(
        "Unknown Template Tag Name: Templates added through the add_template() method must include front-matter with `tag:` property"
      );
    }

    this.templates[data["tag"]] = template;
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
      let allowed_attributes = htmlElementAttributes[top_element.name].concat(
        htmlElementAttributes["*"]
      );
      if (allowed_attributes.indexOf(attr) == -1) {
        continue;
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

  public transform_content(html_content: string) {
    const $ = cheerio.load(html_content);

    for (let [tag, template] of Object.entries(this.templates)) {
      const { content, data } = matter(template);

      if (data["tag"] !== undefined) {
        tag = data["tag"];
      }

      let has_tag = false;
      let _this = this;

      $(tag).each(function () {
        has_tag = true;

        let $el = $(this);
        let expansion = _this.config.nunjucksEnvironment.renderString(content, {
          ...$el.attr(),
          content: $el.html(),
        });

        let attributes = $el.attr();

        if (attributes === undefined) {
          $el.replaceWith(expansion);
          return;
        }

        expansion = _this.forward_html_attributes(expansion, attributes);

        $el.replaceWith(expansion);
      });

      if (data["stylesheet"] !== undefined && has_tag) {
        let stylesheet_path = data["stylesheet"];
        let contents = this.config.styleSheetPreprocessor(stylesheet_path);
        $("head").append(`<style>${contents}</style>`);
      }
    }
    return $.html();
  }

  public eleventyPlugin() {
    return (eleventyConfig: any, pluginOptions: HTMLTagTemplatesOptions) => {
      this.config = pluginOptions;
      this.process_template_directory();
      eleventyConfig.addTransform(
        "html-tag-templates-transform",
        (content: string, outputPath: string) => {
          if (!outputPath.endsWith(".html")) {
            return content;
          }
          return this.transform_content(content);
        }
      );
    };
  }
}
