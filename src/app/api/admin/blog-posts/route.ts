import { NextRequest, NextResponse } from 'next/server';
import { prismaClient } from '@/prisma/db';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const skip = (page - 1) * limit;

    // Get total count for pagination
    const totalPosts = await prismaClient.blogPost.count();
    const totalPages = Math.ceil(totalPosts / limit);

    // @ts-ignore - BlogPost model exists in schema but TypeScript may not recognize it yet
    const blogPosts = await prismaClient.blogPost.findMany({
      orderBy: {
        createdAt: 'desc'
      },
      skip,
      take: limit
    });
    
    // Format the data for the admin interface
    const formattedPosts = blogPosts.map(post => ({
      title: post.title,
      description: post.description,
      date: post.date,
      slug: post.slug,
      ogImageUrl: post.ogImageUrl ? (post.ogImageUrl.startsWith('http') ? post.ogImageUrl : `https://${post.ogImageUrl}`) : '/images/og-image.png'
    }));
    
    return NextResponse.json({
      posts: formattedPosts,
      pagination: {
        currentPage: page,
        totalPages,
        totalPosts,
        postsPerPage: limit
      }
    });
  } catch (error) {
    console.error('Error fetching blog posts:', error);
    return NextResponse.json(
      { 
        message: 'Failed to fetch blog posts',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('Blog post creation/update started...');
    
    const body = await request.json();
    console.log('Request body:', body);
    
    const { title, description, date, slug, content, ogImage, originalSlug } = body;

    if (!title || !content) {
      console.log('Validation failed: Missing title or content');
      return NextResponse.json(
        { message: 'Title and content are required' },
        { status: 400 }
      );
    }

    if (!slug) {
      console.log('Validation failed: Missing slug');
      return NextResponse.json(
        { message: 'Slug is required' },
        { status: 400 }
      );
    }

    // Handle ogImage - it can be a string, an object with url property, or null
    let ogImageUrl: string | null = null;
    if (ogImage) {
      if (typeof ogImage === 'string') {
        ogImageUrl = ogImage;
      } else if (typeof ogImage === 'object' && ogImage.url) {
        ogImageUrl = ogImage.url;
      }
    }

    // Check if this is an update (editing existing post)
    if (originalSlug) {
      console.log('Updating existing post:', originalSlug);
      
      // Check if the post exists
      // @ts-ignore - BlogPost model exists in schema but TypeScript may not recognize it yet
      const existingPost = await prismaClient.blogPost.findUnique({
        where: { slug: originalSlug }
      });

      if (!existingPost) {
        console.log('Original post not found:', originalSlug);
        return NextResponse.json(
          { message: 'Original blog post not found' },
          { status: 404 }
        );
      }

      // If slug has changed, check if new slug already exists
      if (slug !== originalSlug) {
        // @ts-ignore - BlogPost model exists in schema but TypeScript may not recognize it yet
        const slugExists = await prismaClient.blogPost.findUnique({
          where: { slug }
        });

        if (slugExists) {
          console.log('New slug already exists:', slug);
          return NextResponse.json(
            { message: 'A blog post with this slug already exists' },
            { status: 409 }
          );
        }
      }

      console.log('Updating blog post with data:', {
        title,
        description: description || '',
        date: date || new Date().toISOString().split('T')[0],
        slug,
        contentLength: content?.length || 0,
        ogImageUrl
      });

      // Update the blog post
      // @ts-ignore - BlogPost model exists in schema but TypeScript may not recognize it yet
      const updatedPost = await prismaClient.blogPost.update({
        where: { slug: originalSlug },
        data: {
          title,
          description: description || '',
          date: date || new Date().toISOString().split('T')[0],
          slug,
          content,
          ogImageUrl,
          updatedAt: new Date()
        }
      });

      console.log('Blog post updated successfully:', { id: updatedPost.id, title, slug });

      return NextResponse.json({ 
        message: 'Blog post updated successfully',
        blogPost: updatedPost
      });
    } else {
      // Creating new post
      console.log('Checking for existing slug:', slug);
      
      // Check if slug already exists
      // @ts-ignore - BlogPost model exists in schema but TypeScript may not recognize it yet
      const existingPost = await prismaClient.blogPost.findUnique({
        where: { slug }
      });

      if (existingPost) {
        console.log('Slug already exists:', slug);
        return NextResponse.json(
          { message: 'A blog post with this slug already exists' },
          { status: 409 }
        );
      }

      console.log('Creating blog post with data:', {
        title,
        description: description || '',
        date: date || new Date().toISOString().split('T')[0],
        slug,
        contentLength: content?.length || 0,
        ogImageUrl
      });

      // Create the blog post in the database
      // @ts-ignore - BlogPost model exists in schema but TypeScript may not recognize it yet
      const blogPost = await prismaClient.blogPost.create({
        data: {
          title,
          description: description || '',
          date: date || new Date().toISOString().split('T')[0],
          slug,
          content,
          ogImageUrl,
          published: true
        }
      });

      console.log('Blog post created successfully:', { id: blogPost.id, title, slug });

      return NextResponse.json({ 
        message: 'Blog post created successfully',
        blogPost
      });
    }
  } catch (error) {
    console.error('Error saving blog post - Full error object:', error);
    console.error('Error name:', error instanceof Error ? error.name : 'Unknown');
    console.error('Error message:', error instanceof Error ? error.message : 'Unknown error');
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    
    return NextResponse.json(
      { 
        message: 'Failed to save blog post',
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : 'No additional details'
      },
      { status: 500 }
    );
  }
}
