import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { v4 as uuidv4 } from 'uuid';
import sharp from 'sharp';

export const maxDuration = 300; // 5 minutes for large file uploads

interface UploadResponse {
  id: string;
  storage_path: string;
  caption: string | null;
  width: number | null;
  height: number | null;
  created_at: string;
  url: string;
}

interface ErrorResponse {
  error: string;
  details?: string;
}

interface DetailedUploadResponse {
  photos: UploadResponse[];
  failed: string[];
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<UploadResponse[] | UploadResponse | DetailedUploadResponse | ErrorResponse>> {
  try {
    console.log('=== UPLOAD ROUTE STARTED ===');
    const detailedResponse = request.nextUrl.searchParams.get('detailed') === '1';

    // Validate environment variables
    if (
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      !process.env.SUPABASE_SERVICE_ROLE_KEY
    ) {
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

    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

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

    // Verify user is a trip member OR admin/super_admin
    console.log('Verifying trip access...');
    const { data: userProfile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('Profile lookup error:', profileError);
      return NextResponse.json(
        { error: 'Trip access error', details: profileError.message },
        { status: 403 }
      );
    }

    const isAdmin = userProfile?.role === 'admin' || userProfile?.role === 'super_admin';

    if (!isAdmin) {
      const { data: tripMember, error: memberError } = await supabase
        .from('trip_members')
        .select('id')
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
    }
    console.log('User has trip upload access');

    // Validate multipart request and parse form data
    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json(
        { error: 'Invalid content type', details: 'Expected multipart/form-data payload' },
        { status: 400 }
      );
    }

    if (!contentType.includes('boundary=')) {
      return NextResponse.json(
        {
          error: 'Malformed multipart payload',
          details: 'Multipart boundary is missing. Try uploading fewer files per request.',
        },
        { status: 400 }
      );
    }

    console.log('Reading form data...');
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch (parseError) {
      const parseErrorMessage =
        parseError instanceof Error ? parseError.message : 'Unknown multipart parsing error';
      console.error('FormData parsing error:', parseErrorMessage);
      return NextResponse.json(
        {
          error: 'Malformed multipart payload',
          details: `${parseErrorMessage}. This usually means the upload body was truncated; try smaller batches.`,
        },
        { status: 400 }
      );
    }

    const files = formData.getAll('files') as File[];
    const uploadDate = formData.get('uploadDate') as string || new Date().toISOString().split('T')[0];

    console.log(`Found ${files.length} files, uploadDate: ${uploadDate}`);

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: 'No files provided' },
        { status: 400 }
      );
    }

    const uploadedPhotos: UploadResponse[] = [];
    const errors: { file: string; error: string }[] = [];

    // Process each file
    for (const file of files) {
      console.log(`Processing file: ${file.name} (${file.size} bytes, type: ${file.type})`);
      try {
        // Validate file type
        if (!file.type.startsWith('image/')) {
          console.log(`Skipping ${file.name}: not an image (type: ${file.type})`);
          errors.push({
            file: file.name,
            error: 'File is not an image',
          });
          continue;
        }

        // Validate file size (max 50MB)
        if (file.size > 50 * 1024 * 1024) {
          console.log(`Skipping ${file.name}: too large (${file.size} bytes)`);
          errors.push({
            file: file.name,
            error: 'File is too large (max 50MB)',
          });
          continue;
        }

        // Read file buffer
        console.log(`Reading file buffer for ${file.name}...`);
        const buffer = Buffer.from(await file.arrayBuffer());
        console.log(`Buffer created: ${buffer.length} bytes`);

        // Get image dimensions using sharp
        console.log(`Getting metadata for ${file.name}...`);
        let metadata;
        try {
          metadata = await sharp(buffer).metadata();
          console.log(`Metadata: ${metadata.width}x${metadata.height}`);
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : 'Unknown error';
          console.error(`Sharp metadata error for ${file.name}:`, errMsg);
          errors.push({
            file: file.name,
            error: 'Failed to process image metadata',
          });
          continue;
        }

        // Generate unique filename
        const fileExt = file.name.split('.').pop() || 'jpg';
        const uniqueName = `${uuidv4()}.${fileExt}`;
        const storagePath = `${tripId}/${uploadDate}/${uniqueName}`;
        console.log(`Storage path: ${storagePath}`);

        // Upload to Supabase storage
        console.log(`Uploading to Supabase storage...`);
        const { error: uploadError } = await adminSupabase.storage
          .from('photos')
          .upload(storagePath, buffer, {
            contentType: file.type,
            cacheControl: '3600',
          });

        if (uploadError) {
          console.error(`Storage upload error for ${file.name}:`, uploadError);
          errors.push({
            file: file.name,
            error: `Upload failed: ${uploadError.message}`,
          });
          continue;
        }
        console.log(`Successfully uploaded to ${storagePath}`);

        // Create photo record in database
        console.log(`Creating photo record in database...`);
        const { data: photo, error: dbError } = await adminSupabase
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
          console.error(`Database error for ${file.name}:`, dbError);
          // Try to delete the uploaded file
          await adminSupabase.storage.from('photos').remove([storagePath]);
          errors.push({
            file: file.name,
            error: `Failed to save photo record: ${dbError.message}`,
          });
          continue;
        }
        console.log(`Photo record created with ID: ${photo.id}`);

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('photos')
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
        console.log(`Successfully processed ${file.name}`);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        console.error(`Unexpected error processing ${file.name}:`, err);
        errors.push({
          file: file.name,
          error: errorMessage,
        });
      }
    }

    console.log(`Upload complete: ${uploadedPhotos.length} successful, ${errors.length} failed`);

    // If no files were uploaded successfully, return error
    if (uploadedPhotos.length === 0 && errors.length > 0) {
      return NextResponse.json(
        {
          error: `Failed to upload ${errors.length} file(s)`,
          details: errors.map((e) => `${e.file}: ${e.error}`).join('; '),
        },
        { status: 400 }
      );
    }

    if (detailedResponse) {
      return NextResponse.json(
        {
          photos: uploadedPhotos,
          failed: errors.map((entry) => entry.file),
        },
        { status: 201 }
      );
    }

    // Return uploaded photos (legacy response shape)
    return NextResponse.json(uploadedPhotos, { status: 201 });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('=== PHOTO UPLOAD ROUTE ERROR ===', err);
    console.error('Error message:', errorMessage);
    console.error('Error stack:', err instanceof Error ? err.stack : 'No stack trace');
    return NextResponse.json(
      { error: 'Failed to upload photos', details: errorMessage },
      { status: 500 }
    );
  }
}
