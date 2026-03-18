import { prismaClient } from '@/prisma/db';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { wordpressSites, title, content, imageUrl, category, author, saveOption, scheduleTime, metaTitle, metaDescription, addFeaturedImage, addMetaContent } = body;

    const plugin = await prismaClient.plugin.findFirst({
      select: {
        version: true,
      },
    });

    console.log('Plugin version: ' + plugin?.version);

    const results = await Promise.all(
      wordpressSites.map(async (site: string) => {
        try {
          const response = await fetch(`${site}/wp-json/apf/v1/create-post`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              title,
              content,
              image_url: imageUrl,
              category,
              author,
              plugin_version: plugin?.version,
              status: saveOption,
              schedule_time: scheduleTime,
              meta_title: metaTitle,
              meta_description: metaDescription,
              add_featured_image: addFeaturedImage,
              add_meta_content: addMetaContent
            }),
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            
            // Check for WordPress API error structure
            if (errorData.code === 'plugin_version_outdated') {
              throw new Error(errorData.message || 'Plugin version is outdated');
            } else {
              throw new Error(errorData.message || `Failed to publish to ${site}`);
            }
          }

          return {
            site,
            success: true
          };
        } catch (error) {
          console.error('The error is: ', error);
          return {
            site,
            message: error instanceof Error ? error.message : 'Unknown error',
            success: false
          };
        }
      })
    );

    const failedSites = results.filter(result => !result.success);
    
    if (failedSites.length > 0) {
      // Get the error message from failed sites, prioritizing plugin version errors
      const errorMessage = failedSites[0]?.message || 'Failed to publish';
      
      return NextResponse.json({
        success: false,
        message: errorMessage,
        failedSites
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Successfully published to WordPress site'
    });

  } catch (error) {
    console.error('Error publishing to WordPress:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to publish to WordPress site'
    }, { status: 500 });
  }
}