const glob = require("glob");
const { PrismaClient } = require("@prisma/client");

const siteUrl = "https://whoneedsawriter.com";

/** @type {import('next-sitemap').IConfig} */
module.exports = {
  generateIndexSitemap: false,
  additionalPaths: async () => {
    try {
      const routes = await glob.sync("src/app/**/page.{md,mdx,js,jsx,ts,tsx}", {
        cwd: __dirname,
      });

      const blogRoutes = await glob.sync("blogposts/*.mdx", {
        cwd: __dirname,
      });
      let databaseBlogPosts = [];

      try {
        const prisma = new PrismaClient();
        databaseBlogPosts = await prisma.blogPost.findMany({
          where: { published: true },
          select: { slug: true, updatedAt: true },
        });
        await prisma.$disconnect();
      } catch (error) {
        console.error("Unable to fetch database blog posts for sitemap:", error);
      }

      console.log("Routes:", routes);
      console.log("Blog Routes:", blogRoutes);

      const allRoutes = [...routes, ...blogRoutes];

      if (!Array.isArray(allRoutes)) {
        throw new Error("Routes is not an array");
      }

      // Filter out private/authenticated routes
      const publicRoutes = routes.filter(
        (page) => {
          const pathParts = page.split("/");
          // Exclude admin, dashboard, account, articles, article-generator, batch routes
          return !pathParts.some((folder) => 
            folder.startsWith("_") || 
            folder === "admin" || 
            folder === "dashboard" || 
            folder === "account" || 
            folder === "articles" || 
            folder === "article-generator" || 
            folder === "batch" ||
            folder === "api" ||
            folder === "supabase"
          );
        }
      );

      const publicRoutesWithoutRouteGroups = publicRoutes.map((page) =>
        page
          .split("/")
          .filter((folder) => !folder.startsWith("(") && !folder.endsWith(")"))
          .join("/")
      );

      // Define static public pages with their priorities
      const staticPages = [
        { path: "", priority: 1.0, changefreq: "daily" }, // Homepage
        { path: "pricing", priority: 0.8, changefreq: "weekly" },
        { path: "privacy", priority: 0.3, changefreq: "monthly" },
        { path: "terms", priority: 0.3, changefreq: "monthly" },
        { path: "blog", priority: 0.7, changefreq: "weekly" },
      ];

      const staticLocs = staticPages.map((page) => ({
        changefreq: page.changefreq,
        lastmod: new Date().toISOString(),
        loc: page.path === "" ? siteUrl : `${siteUrl}/${page.path}`,
        priority: page.priority,
      }));

      // Process blog posts - exclude specific test/demo posts
      const excludedBlogPosts = [
        "blogpost-slug-copy",
        "blogpost-slug", 
        "how-to-write-a-great-blog-post",
        "xczxc"
      ];
      
      const blogLocs = blogRoutes
        .map((route) => {
          const path = route.replace(/^blogposts\//, "").replace(/\.mdx$/, "");
          return path;
        })
        .filter((path) => !excludedBlogPosts.includes(path))
        .map((path) => ({
          changefreq: "monthly",
          lastmod: new Date().toISOString(),
          loc: `${siteUrl}/blog/${path}`,
          priority: 0.6,
        }));
      const databaseBlogLocs = databaseBlogPosts.map((post) => ({
        changefreq: "monthly",
        lastmod: post.updatedAt?.toISOString?.() || new Date().toISOString(),
        loc: `${siteUrl}/blog/${post.slug}`,
        priority: 0.6,
      }));

      const pathsByLoc = new Map();
      [...staticLocs, ...blogLocs, ...databaseBlogLocs].forEach((path) => {
        pathsByLoc.set(path.loc, path);
      });
      const paths = Array.from(pathsByLoc.values());

      console.log("Generated sitemap paths:", paths);
      return paths;
    } catch (error) {
      console.error("Error fetching routes:", error);
      return [];
    }
  },
  generateRobotsTxt: true,
  siteUrl,
  exclude: [
    "/admin/*",
    "/dashboard/*", 
    "/account/*",
    "/articles/*",
    "/article-generator/*",
    "/batch/*",
    "/login",
    "/signup",
    "/api/*",
    "/supabase/*"
  ],
};
