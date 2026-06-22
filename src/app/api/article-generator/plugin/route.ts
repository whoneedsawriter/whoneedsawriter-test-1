import { prismaClient } from "@/prisma/db";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/config/auth";
import { getPluginGenerationAccessFailure } from "@/libs/plugin-account-access";
import { spendCredits } from "@/libs/credits";

// Function to get all articles for a user
async function getAllArticles(userId: string) {
  return await prismaClient.godmodeArticles.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
}

// Function to get articles by batch for a user
async function getArticlesByBatch(userId: string, batchId: string) {
  return await prismaClient.godmodeArticles.findMany({
    where: { userId, batchId: batchId },
    orderBy: { createdAt: "desc" },
  });
}

// Function to get a single article by ID for a user
async function getArticleById(userId: string, id: string) {
  return await prismaClient.godmodeArticles.findUnique({
    where: { id },
  });
}

export async function GET(req: NextRequest) {
  try {
    // Get user session
    const session = await getServerSession(authOptions);

    if (!session || !session.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session?.user.id as string;
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const batchId = searchParams.get("batchId");

    let todos;

    if (id) {
      // Fetch a single article by ID for the logged-in user
      const article = await getArticleById(userId, id);
      if (!article) {
        return NextResponse.json({ error: "Article not found" }, { status: 404 });
      }
      const batch = await prismaClient.batch.findUnique({
        where: { id: article.batchId },
      });
      return NextResponse.json({ todos: [article], batch_name: batch?.name }); // Wrap in an array for consistency
    } else if (batchId) {
      // Fetch articles filtered by batch for the logged-in user
      todos = await getArticlesByBatch(userId, batchId);
    } else {
      // Fetch all articles for the logged-in user
      todos = await getAllArticles(userId);
    }

    return NextResponse.json({ todos });
  } catch (error) {
    console.error("Error fetching articles:", error);
    return NextResponse.json(
      { error: "Failed to fetch articles" },
      { status: 500 }
    );
  }
}


// Function to calculate credit cost based on selected model
function getCreditCost(model: string): number {
  switch (model) {
    case '1a-lite':
      return 0.1;
    case '1a-core':
      return 1;
    case '1a-pro':
      return 2;
    default:
      return 2; // Default to 1a Pro cost
  }
}

export async function POST(request: Request) {
  
  try {
    const {userId, batchId, textKeywords, model, wordLimit, featuredImage, infographics, specialInstructions, externalLinks, references, category, author } = await request.json();
    if (!userId || typeof userId !== "string") {
      return NextResponse.json({ error: "User ID is required" }, { status: 401 });
    }
    if (!batchId || typeof batchId !== "string") {
      return NextResponse.json({ error: "Batch ID is required" }, { status: 400 });
    }
    if (!textKeywords || typeof textKeywords !== "string") {
      return NextResponse.json({ error: "Invalid keyword" }, { status: 400 });
    }
    if (!model || typeof model !== "string") {
      return NextResponse.json({ error: "Invalid model" }, { status: 400 });
    }

        const accessFailure = await getPluginGenerationAccessFailure(userId);
        if (accessFailure) {
          return NextResponse.json(
            { error: accessFailure.error, code: accessFailure.code },
            { status: accessFailure.status }
          );
        }

        // Split the text into individual keywords
        const keywords = textKeywords.split(',').map((keyword: string) => keyword.trim()).filter(Boolean);
        if (keywords.length === 0) {
          return NextResponse.json({ error: "Invalid keyword" }, { status: 400 });
        }
        const creditCostPerArticle = getCreditCost(model || '1a-pro');
        const totalCreditCost = parseFloat((keywords.length * creditCostPerArticle).toFixed(1));
        try {
          await spendCredits({
            userId,
            amount: totalCreditCost,
            idempotencyKey: `plugin_generation_spend:${userId}:${batchId}`,
            metadata: {
              batchId,
              model,
              keywordCount: keywords.length,
              source: "plugin",
            },
          });
        } catch (error) {
          return NextResponse.json(
            { error: error instanceof Error ? error.message : "Insufficient credits" },
            { status: 400 }
          );
        }

        const articles = [];

        const categories = (category ?? '').split(',').map((s: string) => s.trim());
        const authors = (author ?? '').split(',').map((s: string) => s.trim());

        for (let index = 0; index < keywords.length; index++) {
          const keyword = keywords[index];
             let article = await prismaClient.godmodeArticles.create({
                data: {
                    userId,
                    batchId: batchId,
                    keyword: keyword,
                    model: model,
                    articleType: 'godmode',
                    featuredImageRequired: featuredImage === 'yes' ? 'Yes' : 'No',
                    additionalImageRequired: infographics === 'yes' ? 'Yes' : 'No',
                    wordLimit: wordLimit ? parseInt(wordLimit) : undefined,
                    comment: specialInstructions || '.',
                    links: externalLinks === 'Yes' ? 'Yes' : 'No',
                    toneChoice: '',
                    perspective: '',
                    description: '',
                    references: references === 'Yes' ? 'Yes' : 'No',
                    category: categories[index] || categories[0] || '',
                    author: authors[index] || authors[0] || '',
                } as any,
            });

            // Create corresponding pending article entry
            await prismaClient.pendingGodmodeArticles.create({
                data: {
                    userId,
                    keywordId: keyword,
                    batchId: batchId,
                    cronRequest: 0,
                    godmodeArticleId: article.id
                }
            });

            articles.push(article);
        }

        // Respond to the client after all webhooks finish
        return NextResponse.json({ status: 200, articles });

  } catch (error) {
    console.error("Error creating article:", error);
    return NextResponse.json(
      { error: "Failed to create article" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {    
    const session = await getServerSession(authOptions);
    const userId = session?.user.id as string;

    const request_data = await request.json();

    if(request_data.type === 'article_upadte'){
      console.log(request_data.aiScore);
      if (!request_data.id || typeof request_data.id !== "string") {
        return NextResponse.json({ error: "Invalid article id" }, { status: 400 });
      }
  
      if (request_data.content !== undefined && typeof request_data.content !== "string") {
        return NextResponse.json({ error: "Invalid article text" }, { status: 400 });
      }
  
      const updatedTodo = await prismaClient.godmodeArticles.update({
        where: { id: request_data.id },
        data: {
          content: request_data.content,
          aiScore: request_data.aiScore
        },
      });
  
      return NextResponse.json({ todo: updatedTodo });
    }

  } catch (error) {
    console.error("Error updating", error);
    return NextResponse.json(
      { error: "Failed to update" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { id } = await request.json();

    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "Invalid a id" }, { status: 400 });
    }

    await prismaClient.godmodeArticles.delete({
      where: { id },
    });

    return NextResponse.json({ message: "Article deleted successfully" });
  } catch (error) {
    console.error("Error deleting article:", error);
    return NextResponse.json(
      { error: "Failed to delete article" },
      { status: 500 }
    );
  }
}
