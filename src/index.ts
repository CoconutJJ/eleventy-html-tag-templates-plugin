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

class TagTemplate {
  private tag_name: string;
  private template_content: string;
  private stylesheet_path: string = "";
  private nunjucksEnvironment: NunjucksEnvironment;

  constructor(
    template_filepath: string,
    nunjucksEnvironment: NunjucksEnvironment
  ) {
    this.nunjucksEnvironment = nunjucksEnvironment;

    let contents = readFileSync(template_filepath).toString();

    let { content, data } = matter(contents);

    if (!("tag" in data)) {
      this.tag_name = template_filepath.split("/")[-1].split(".")[0];
    } else {
      this.tag_name = data["tag"];
    }

    if ("stylesheet" in data) {
      this.stylesheet_path = data["stylesheet"];
    }

    this.template_content = content;
  }

  public render(variables: object) {
    return this.nunjucksEnvironment.renderString(
      this.template_content,
      variables
    );
  }

  public stylesheet() {
    return this.stylesheet_path;
  }

  public tagname() {
    return this.tag_name;
  }
}

export class HTMLTagTemplates {
  private config: HTMLTagTemplatesOptions;
  private templates: { [key: string]: TagTemplate } = {};

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

      let template = new TagTemplate(
        full_path,
        this.config.nunjucksEnvironment
      );

      this.templates[template.tagname()] = template;
    }
  }

  private get_classlist(attributes: Record<string, string>) {
    let attr = "class";

    if (attr in attributes) {
      return attributes[attr].split(" ");
    }

    return [];
  }

  private get_idlist(attributes: Record<string, string>) {
    let attr = "id";

    if (attr in attributes) {
      return attributes[attr].split(" ");
    }

    return [];
  }

  private get_stylelist(attributes: Record<string, string>) {
    let attr = "style";

    if (attr in attributes) {
      return attributes[attr].split(" ");
    }

    return [];
  }

  public recursive_template_transform(html_content: string) {
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
      let has_tag = false;

      $(tag).each(function () {
        has_tag = true;
        did_transform = true;
        let $el = $(this);
        let attributes = $el.attr();

        if (!attributes) attributes = {};

        // render the template definition
        let expansion = template.render({
          ...attributes,
          content: $el.html(),
          forward: (...keys: string[]) => {
            let attribute_list = [];
            let expanded_keys = new Set<string>();

            if (keys.length > 0) {
              for (let key of keys) {
                if (key == "*") {
                  Object.keys(attributes).forEach((e) => expanded_keys.add(e));
                  continue;
                }

                if (key.startsWith("!")) {
                  expanded_keys.delete(key.slice(1));
                  continue;
                }

                expanded_keys.add(key);
              }
            } else {
              expanded_keys = new Set(Object.keys(attributes));
            }

            for (let key of expanded_keys) {
              if (key in attributes) {
                let value = attributes[key];
                attribute_list.push(`${key}=${value}`);
              }
            }

            return attribute_list.join(" ");
          },
        });

        // replace tag template with expansion
        $el.replaceWith(expansion);
      });

      if (!has_tag) {
        continue;
      }

      if (processed_tags.has(tag)) {
        continue;
      }

      template_css += this.config.styleSheetPreprocessor(template.stylesheet());
      processed_tags.add(tag);
    }
    return { html: $.html(), css: template_css, transformed: did_transform };
  }

  public eleventyPlugin() {
    return (eleventyConfig: any, pluginOptions: HTMLTagTemplatesOptions) => {
      this.config = pluginOptions;
      this.process_template_directory(this.config.tagTemplateDirectory);
      eleventyConfig.addWatchTarget(this.config.tagTemplateDirectory);
      eleventyConfig.addTransform(
        "html-tag-templates-transform",
        (content: string, outputPath: string) => {
          if (!outputPath.endsWith(".html")) {
            return content;
          }
          return this.recursive_template_transform(content);
        }
      );
    };
  }
}
