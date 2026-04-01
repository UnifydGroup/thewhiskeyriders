import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { v4 as uuidv4 } from 'uuid';
import sharp from 'sharp';
import JSZip from 'jszip';

export const maxDuration = 600; // 10 minutes for large ZIP files

interface UploadResponse {
  id: string;
  storage_path: string;
  caption: string | null;
  width: number | null;
  height: number | null;
  created_at: string;
  url: string;
}

interface ZipUploadResponse {
  uploaded: UploadResponse[];
  failed: Array<{
    filename: string;
    error: string;
  }>;
  summary: {
    total: number;
    success: number;
    failed: number;
  };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ZipUploadResponse | { error: string; details?: string }>> {
  try {
    console.log('=== ZIP UPLOAD ROUTE STARTED ===');

    // Validate environment variables
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      console.error('Missing Supabase environment variables');
      return NextResponse.json(
        { error: 'Server configuration error', details: 'Missing Supabase credentials' },
        { status: 500 }
      );
    }

    // Create Supabase client with cookies
    console.log('Creating Supabase client...');
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          },
        },
      }
    );
    console.log('Supabase client created successfully');

    // Resolve async params
    const resolvedParams = await params;
    const tripId = resolvedParams.id;
    console.log('Trip ID:', tripId);

    // Get current user
    console.log('Getting current user...');
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      console.error('Auth error:', authError);
      return NextResponse.json(
        { error: 'Authentication error', details: authError.message },
        { status: 401 }
      );
    }

    if (!user) {
      console.error('No user found');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    console.log('User authenticated:', user.id);

    // Verify user is a trip member
    console.log('Verifying trip membership...');
    const { data: tripMember, error: memberError } = await supabase
      .from('trip_members')
      .select('*')
      .eq('trip_id', tripId)
      .eq('user_id', user.id)
      .single();

    if (memberError) {
      console.error('Trip membership check error:', memberError);
      return NextResponse.json(
        { error: 'Trip access error', details: memberError.message },
        { status: 403 }
      );
    }

    if (!tripMember) {
      console.error('User not a trip member');
      return NextResponse.json(
        { error: 'Not a member of this trip' },
        { status: 403 }
      );
    }
    console.log('User is trip member');

    // Get form data
    console.log('Reading form data...');
    const formData = await request.formData();
    const zipFile = formData.get('file') as File;
    const uploadDate = formData.get('uploadDate') as string || new Date().toISOString().split('T')[0];
    console.log(`ZIP file: ${zipFile?.name}, uploadDate: ${uploadDate}`);

    if (!zipFile || !zipFile.name.endsWith('.zip')) {
      return NextResponse.json(
        { error: 'Please provide a valid ZIP file' },
        { status: 400 }
      );
    }

    const uploadedPhotos: UploadResponse[] = [];
    const failedFiles: Array<{ filename: string; error: string }> = [];

    // Extract and process ZIP file
    try {
      console.log('Starting ZIP processing...');
      const buffer = Buffer.from(await zipFile.arrayBuffer());
      console.log('ZIP buffer created, size:', buffer.length);

      // Use JSZip to extract files
      const zip = new JSZip();
      console.log('JSZip instance created');
      await zip.loadAsync(buffer);
      console.log('ZIP loaded successfully');

      // Process each entry in the ZIP
      const fileEntries = Object.entries(zip.files).filter(
        ([, file]) => !file.dir
      );
      console.log(`Found ${fileEntries.length} file entries in ZIP`);

      for (const [filePath, file] of fileEntries) {
        console.log(`Processing ZIP entry: ${filePath}`);

        // Skip directories
        if (file.dir) {
          console.log(`Skipping directory: ${filePath}`);
          continue;
        }

        const filename = filePath.split('/').pop() || '';
        const mimeType = getMimeType(filename);
        console.log(`File: ${filename}, MIME type: ${mimeType}`);

        if (!mimeType || !mimeType.startsWith('image/')) {
          console.log(`Skipping ${filePath}: not an image`);
          failedFiles.push({
            filename: filePath,
            error: 'Not an image file',
          });
          continue;
        }

        try {
          // Get file buffer
          console.log(`Getting buffer for ${filename}...`);
          const fileBuffer = await file.async('arraybuffer');
          const fileBufferNode = Buffer.from(fileBuffer);
          console.log(`Buffer size: ${fileBufferNode.length} bytes`);

          // Validate file size
          if (fileBufferNode.length > 50 * 1024 * 1024) {
            console.log(`Skipping ${filePath}: too large (${fileBufferNode.length} bytes)`);
            failedFiles.push({
              filename: filePath,
              error: 'File is too large (max 50MB)',
            });
            continue;
          }

          // Get image dimensions
          console.log(`Getting metadata for ${filename}...`);
          let metadata;
          try {
            metadata = await sharp(fileBufferNode).metadata();
            console.log(`Metadata: ${metadata.width}x${metadata.height}`);
          } catch (err) {
            const errMsg = err instanceof Error ? err.message : 'Unknown error';
            console.error(`Sharp metadata error for ${filename}:`, errMsg);
            failedFiles.push({
              filename: filePath,
              error: 'Failed to process image metadata',
            });
            continue;
          }

          // Generate unique filename
          const fileExt = filename.split('.').pop() || 'jpg';
          const uniqueName = `${uuidv4()}.${fileExt}`;
          const storagePath = `${tripId}/${uploadDate}/${uniqueName}`;
          console.log(`Storage path: ${storagePath}`);

          // Upload to Supabase storage
          console.log(`Uploading to Supabase storage...`);
          const { error: uploadError } = await supabase.storage
            .from('whiskey-riders')
            .upload(storagePath, fileBufferNode, {
              contentType: mimeType,
              cacheControl: '3600',
            });

          if (uploadError) {
            console.error(`Storage upload error for ${filename}:`, uploadError);
            failedFiles.push({
              filename: filePath,
              error: `Upload failed: ${uploadError.message}`,
            });
            continue;
          }
          console.log(`Successfully uploaded to ${storagePath}`);

          // Create photo record in database
          console.log(`Creating photo record in database...`);
          const { data: photo, error: dbError } = await supabase
            .from('photos')
            .insert({
              trip_id: tripId,
              uploaded_by: user.id,
              storage_path: storagePath,
              width: metadata.width,
              height: metadata.height,
              caption: null,
            })
            .select('*')
            .single();

          if (dbError) {
            console.error(`Database error for ${filename}:`, dbError);
            // Try to delete the uploaded file
            await supabase.storage.from('whiskey-riders').remove([storagePath]);
            failedFiles.push({
              filename: filePath,
              error: `Failed to save photo record: ${dbError.message}`,
            });
            continue;
          }
          console.log(`Photo record created with ID: ${photo.id}`);

          // Get public URL
          const { data: { publicUrl } } = supabase.storage
            .from('whiskey-riders')
            .getPublicUrl(storagePath);

          uploadedPhotos.push({
            id: photo.id,
            storage_path: storagePath,
            caption: photo.caption,
            width: photo.width,
            height: photo.height,
            created_at: photo.created_at,
            url: publicUrl,
          });
          console.log(`Successfully processed ${filename}`);
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Unknown error';
          console.error(`Unexpected error processing ${filePath}:`, err);
          failedFiles.push({
            filename: filePath,
            error: errorMessage,
          });
        }
      }
      console.log(`ZIP processing complete: ${uploadedPhotos.length} successful, ${failedFiles.length} failed`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('=== ZIP PROCESSING ERROR ===', err);
      console.error('Error message:', errorMessage);
      console.error('Error stack:', err instanceof Error ? err.stack : 'No stack trace');
      return NextResponse.json(
        { error: 'Failed to process ZIP file', details: errorMessage },
        { status: 400 }
      );
    }

    const response: ZipUploadResponse = {
      uploaded: uploadedPhotos,
      failed: failedFiles,
      summary: {
        total: uploadedPhotos.length + failedFiles.length,
        success: uploadedPhotos.length,
        failed: failedFiles.length,
      },
    };

    console.log('=== ZIP UPLOAD SUCCESS ===');
    console.log('Response:', response);
    return NextResponse.json(response, { status: 201 });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('=== ZIP UPLOAD ROUTE ERROR ===', err);
    console.error('Error message:', errorMessage);
    console.error('Error stack:', err instanceof Error ? err.stack : 'No stack trace');
    return NextResponse.json(
      { error: 'Failed to process ZIP upload', details: errorMessage },
      { status: 500 }
    );
  }
}

function getMimeType(filename: string): string | null {
  const ext = filename.split('.').pop()?.toLowerCase();
  const mimeTypes: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    bmp: 'image/bmp',
  };
  return mimeTypes[ext || ''] || null;
}
