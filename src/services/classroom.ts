import { google } from 'googleapis';
import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: any;
}

function ok(data: any) {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}

export function getTools(): ToolDefinition[] {
  return [
    // ── Course Management ──────────────────────────────────────────────────
    {
      name: 'list_courses',
      description: 'List all Google Classroom courses the user has access to',
      inputSchema: {
        type: 'object',
        properties: {
          teacherId: { type: 'string', description: 'Filter by teacher userId' },
          studentId: { type: 'string', description: 'Filter by student userId' },
          courseState: { type: 'string', description: 'Filter by state: ACTIVE, ARCHIVED, PROVISIONED, DECLINED' },
          pageSize: { type: 'number', description: 'Max results per page (default 100)' },
          pageToken: { type: 'string', description: 'Page token for next page' },
        },
      },
    },
    {
      name: 'get_course',
      description: 'Get details of a specific Google Classroom course',
      inputSchema: {
        type: 'object',
        properties: {
          courseId: { type: 'string', description: 'Course ID' },
        },
        required: ['courseId'],
      },
    },
    {
      name: 'create_course',
      description: 'Create a new Google Classroom course',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Course name' },
          section: { type: 'string', description: 'Course section' },
          description: { type: 'string', description: 'Course description' },
          room: { type: 'string', description: 'Room identifier' },
          ownerId: { type: 'string', description: 'Owner email or userId (required by API)' },
        },
        required: ['name', 'ownerId'],
      },
    },
    {
      name: 'update_course',
      description: 'Update properties of an existing course',
      inputSchema: {
        type: 'object',
        properties: {
          courseId: { type: 'string', description: 'Course ID' },
          name: { type: 'string', description: 'New course name' },
          section: { type: 'string', description: 'New section' },
          description: { type: 'string', description: 'New description' },
          room: { type: 'string', description: 'New room' },
        },
        required: ['courseId'],
      },
    },
    {
      name: 'delete_course',
      description: 'Delete or archive a course',
      inputSchema: {
        type: 'object',
        properties: {
          courseId: { type: 'string', description: 'Course ID' },
        },
        required: ['courseId'],
      },
    },
    {
      name: 'update_course_state',
      description: 'Change the state of a course',
      inputSchema: {
        type: 'object',
        properties: {
          courseId: { type: 'string', description: 'Course ID' },
          courseState: { type: 'string', description: 'New state: ACTIVE, ARCHIVED, PROVISIONED' },
        },
        required: ['courseId', 'courseState'],
      },
    },

    // ── Announcements ──────────────────────────────────────────────────────
    {
      name: 'list_announcements',
      description: 'List announcements in a course',
      inputSchema: {
        type: 'object',
        properties: {
          courseId: { type: 'string', description: 'Course ID' },
          pageSize: { type: 'number', description: 'Max results per page' },
          pageToken: { type: 'string', description: 'Page token for next page' },
          orderBy: { type: 'string', description: 'Sort order: updateDesc, createDesc' },
        },
        required: ['courseId'],
      },
    },
    {
      name: 'get_announcement',
      description: 'Get details of a specific announcement',
      inputSchema: {
        type: 'object',
        properties: {
          courseId: { type: 'string', description: 'Course ID' },
          announcementId: { type: 'string', description: 'Announcement ID' },
        },
        required: ['courseId', 'announcementId'],
      },
    },
    {
      name: 'create_announcement',
      description: 'Create an announcement in a course',
      inputSchema: {
        type: 'object',
        properties: {
          courseId: { type: 'string', description: 'Course ID' },
          text: { type: 'string', description: 'Announcement text' },
          materials: { type: 'array', description: 'Array of material objects (link, driveFile, youTube, form)' },
          state: { type: 'string', description: 'PUBLISHED or DRAFT' },
          announceToAllStudents: { type: 'boolean', description: 'Announce to all students (default true)' },
          individualStudentIds: { type: 'array', items: { type: 'string' }, description: 'Specific student IDs (if not all)' },
        },
        required: ['courseId', 'text'],
      },
    },
    {
      name: 'update_announcement',
      description: 'Update an existing announcement',
      inputSchema: {
        type: 'object',
        properties: {
          courseId: { type: 'string', description: 'Course ID' },
          announcementId: { type: 'string', description: 'Announcement ID' },
          text: { type: 'string', description: 'New announcement text' },
          materials: { type: 'array', description: 'New materials array' },
          state: { type: 'string', description: 'PUBLISHED or DRAFT' },
        },
        required: ['courseId', 'announcementId'],
      },
    },
    {
      name: 'delete_announcement',
      description: 'Delete an announcement',
      inputSchema: {
        type: 'object',
        properties: {
          courseId: { type: 'string', description: 'Course ID' },
          announcementId: { type: 'string', description: 'Announcement ID' },
        },
        required: ['courseId', 'announcementId'],
      },
    },

    // ── Course Work ────────────────────────────────────────────────────────
    {
      name: 'list_coursework',
      description: 'List coursework items in a course',
      inputSchema: {
        type: 'object',
        properties: {
          courseId: { type: 'string', description: 'Course ID' },
          pageSize: { type: 'number', description: 'Max results per page' },
          pageToken: { type: 'string', description: 'Page token for next page' },
          orderBy: { type: 'string', description: 'Sort order: updateDesc, createDesc' },
        },
        required: ['courseId'],
      },
    },
    {
      name: 'get_coursework',
      description: 'Get details of a specific coursework item',
      inputSchema: {
        type: 'object',
        properties: {
          courseId: { type: 'string', description: 'Course ID' },
          courseworkId: { type: 'string', description: 'CourseWork ID' },
        },
        required: ['courseId', 'courseworkId'],
      },
    },
    {
      name: 'create_coursework',
      description: 'Create a coursework item (assignment, quiz, material, etc.)',
      inputSchema: {
        type: 'object',
        properties: {
          courseId: { type: 'string', description: 'Course ID' },
          title: { type: 'string', description: 'Title' },
          description: { type: 'string', description: 'Description' },
          materials: { type: 'array', description: 'Array of material objects' },
          workType: { type: 'string', description: 'ASSIGNMENT, MULTIPLE_CHOICE_QUESTION, SHORT_ANSWER_QUESTION, MATERIAL' },
          state: { type: 'string', description: 'PUBLISHED or DRAFT' },
          dueDate: {
            type: 'object',
            description: 'Due date { year, month, day }',
            properties: { year: { type: 'number' }, month: { type: 'number' }, day: { type: 'number' } },
          },
          dueTime: {
            type: 'object',
            description: 'Due time { hours, minutes, seconds, nanos, timeZone }',
            properties: {
              hours: { type: 'number' },
              minutes: { type: 'number' },
              seconds: { type: 'number' },
              nanos: { type: 'number' },
              timeZone: { type: 'string' },
            },
          },
          assigneeMode: { type: 'string', description: 'ALL_STUDENTS or INDIVIDUAL_STUDENTS' },
          individualStudentIds: { type: 'array', items: { type: 'string' }, description: 'Student IDs if assigneeMode is INDIVIDUAL_STUDENTS' },
          maxPoints: { type: 'number', description: 'Maximum points' },
          submissionModificationMode: { type: 'string', description: 'MODIFIABLE, UNMODIFIABLE_SUBMIT_UNTIL_LATE, MODIFIABLE_UNTIL_RELEASE' },
        },
        required: ['courseId', 'title', 'workType'],
      },
    },
    {
      name: 'update_coursework',
      description: 'Update an existing coursework item',
      inputSchema: {
        type: 'object',
        properties: {
          courseId: { type: 'string', description: 'Course ID' },
          courseworkId: { type: 'string', description: 'CourseWork ID' },
          title: { type: 'string', description: 'New title' },
          description: { type: 'string', description: 'New description' },
          materials: { type: 'array', description: 'New materials' },
          state: { type: 'string', description: 'PUBLISHED or DRAFT' },
          dueDate: {
            type: 'object',
            properties: { year: { type: 'number' }, month: { type: 'number' }, day: { type: 'number' } },
          },
          dueTime: {
            type: 'object',
            properties: {
              hours: { type: 'number' },
              minutes: { type: 'number' },
              seconds: { type: 'number' },
              nanos: { type: 'number' },
              timeZone: { type: 'string' },
            },
          },
          maxPoints: { type: 'number' },
          assigneeMode: { type: 'string' },
          individualStudentIds: { type: 'array', items: { type: 'string' } },
        },
        required: ['courseId', 'courseworkId'],
      },
    },
    {
      name: 'delete_coursework',
      description: 'Delete a coursework item',
      inputSchema: {
        type: 'object',
        properties: {
          courseId: { type: 'string', description: 'Course ID' },
          courseworkId: { type: 'string', description: 'CourseWork ID' },
        },
        required: ['courseId', 'courseworkId'],
      },
    },

    // ── Student Submissions ────────────────────────────────────────────────
    {
      name: 'list_student_submissions',
      description: 'List student submissions for a coursework item or student',
      inputSchema: {
        type: 'object',
        properties: {
          courseId: { type: 'string', description: 'Course ID' },
          courseworkId: { type: 'string', description: 'CourseWork ID (required)' },
          userId: { type: 'string', description: 'Filter by student userId (use "me" for self)' },
          late: { type: 'string', description: 'Filter late: LATE, NOT_LATE, ANY' },
          submissionState: { type: 'string', description: 'Filter: NEW, CREATED, TURNED_IN, RETURNED, RECLAIMED_BY_STUDENT, DELETED' },
          pageSize: { type: 'number', description: 'Max results per page' },
          pageToken: { type: 'string', description: 'Page token' },
        },
        required: ['courseId', 'courseworkId'],
      },
    },
    {
      name: 'get_student_submission',
      description: 'Get a specific student submission',
      inputSchema: {
        type: 'object',
        properties: {
          courseId: { type: 'string', description: 'Course ID' },
          courseworkId: { type: 'string', description: 'CourseWork ID' },
          submissionId: { type: 'string', description: 'Submission ID' },
        },
        required: ['courseId', 'courseworkId', 'submissionId'],
      },
    },
    {
      name: 'submit_student_submission',
      description: 'Turn in (submit) a student submission',
      inputSchema: {
        type: 'object',
        properties: {
          courseId: { type: 'string', description: 'Course ID' },
          courseworkId: { type: 'string', description: 'CourseWork ID' },
          submissionId: { type: 'string', description: 'Submission ID' },
        },
        required: ['courseId', 'courseworkId', 'submissionId'],
      },
    },
    {
      name: 'unsubmit_student_submission',
      description: 'Unsubmit a student submission, returning it to NEW state',
      inputSchema: {
        type: 'object',
        properties: {
          courseId: { type: 'string', description: 'Course ID' },
          courseworkId: { type: 'string', description: 'CourseWork ID' },
          submissionId: { type: 'string', description: 'Submission ID' },
        },
        required: ['courseId', 'courseworkId', 'submissionId'],
      },
    },
    {
      name: 'add_student_submission_attachment',
      description: 'Add a file attachment to a draft student submission',
      inputSchema: {
        type: 'object',
        properties: {
          courseId: { type: 'string', description: 'Course ID' },
          courseworkId: { type: 'string', description: 'CourseWork ID' },
          submissionId: { type: 'string', description: 'Submission ID' },
          driveFile: {
            type: 'object',
            description: 'Google Drive file attachment { id, title }',
            properties: {
              id: { type: 'string', description: 'Google Drive file ID' },
              title: { type: 'string', description: 'File title' },
            },
          },
          youTubeVideo: {
            type: 'object',
            description: 'YouTube video { id, title, alternateLink }',
            properties: {
              id: { type: 'string' },
              title: { type: 'string' },
              alternateLink: { type: 'string' },
            },
          },
          link: {
            type: 'object',
            description: 'Web link { url, title }',
            properties: {
              url: { type: 'string' },
              title: { type: 'string' },
            },
          },
          form: {
            type: 'object',
            description: 'Google Form { formUrl, responseUrl }',
            properties: {
              formUrl: { type: 'string' },
              responseUrl: { type: 'string' },
            },
          },
        },
        required: ['courseId', 'courseworkId', 'submissionId'],
      },
    },
    {
      name: 'modify_attachments',
      description: 'Replace all attachments on a student submission',
      inputSchema: {
        type: 'object',
        properties: {
          courseId: { type: 'string', description: 'Course ID' },
          courseworkId: { type: 'string', description: 'CourseWork ID' },
          submissionId: { type: 'string', description: 'Submission ID' },
          addAttachments: { type: 'array', description: 'Attachments to add (driveFile, link, youTubeVideo, form objects)' },
          removeAttachmentIds: { type: 'array', items: { type: 'string' }, description: 'Attachment IDs to remove' },
        },
        required: ['courseId', 'courseworkId', 'submissionId'],
      },
    },
    {
      name: 'return_student_submission',
      description: 'Teacher returns a submission to the student with optional grade and comments',
      inputSchema: {
        type: 'object',
        properties: {
          courseId: { type: 'string', description: 'Course ID' },
          courseworkId: { type: 'string', description: 'CourseWork ID' },
          submissionId: { type: 'string', description: 'Submission ID' },
          draftGrade: { type: 'number', description: 'Draft grade' },
          assignedGrade: { type: 'number', description: 'Assigned (final) grade' },
          commentText: { type: 'string', description: 'Comment to include when returning' },
        },
        required: ['courseId', 'courseworkId', 'submissionId'],
      },
    },
    {
      name: 'reclaim_student_submission',
      description: 'Teacher reclaims a submission that was returned to the student',
      inputSchema: {
        type: 'object',
        properties: {
          courseId: { type: 'string', description: 'Course ID' },
          courseworkId: { type: 'string', description: 'CourseWork ID' },
          submissionId: { type: 'string', description: 'Submission ID' },
        },
        required: ['courseId', 'courseworkId', 'submissionId'],
      },
    },

    // ── Grades ─────────────────────────────────────────────────────────────
    {
      name: 'grade_student_submission',
      description: 'Set the assigned grade and optional draft grade on a submission',
      inputSchema: {
        type: 'object',
        properties: {
          courseId: { type: 'string', description: 'Course ID' },
          courseworkId: { type: 'string', description: 'CourseWork ID' },
          submissionId: { type: 'string', description: 'Submission ID' },
          assignedGrade: { type: 'number', description: 'Final assigned grade' },
          draftGrade: { type: 'number', description: 'Draft grade (visible to student before return)' },
        },
        required: ['courseId', 'courseworkId', 'submissionId', 'assignedGrade'],
      },
    },

    // ── Topics ─────────────────────────────────────────────────────────────
    {
      name: 'list_topics',
      description: 'List topics in a course',
      inputSchema: {
        type: 'object',
        properties: {
          courseId: { type: 'string', description: 'Course ID' },
          pageSize: { type: 'number', description: 'Max results per page' },
          pageToken: { type: 'string', description: 'Page token' },
        },
        required: ['courseId'],
      },
    },
    {
      name: 'create_topic',
      description: 'Create a new topic in a course',
      inputSchema: {
        type: 'object',
        properties: {
          courseId: { type: 'string', description: 'Course ID' },
          name: { type: 'string', description: 'Topic name' },
        },
        required: ['courseId', 'name'],
      },
    },
    {
      name: 'update_topic',
      description: 'Update the name of a topic',
      inputSchema: {
        type: 'object',
        properties: {
          courseId: { type: 'string', description: 'Course ID' },
          topicId: { type: 'string', description: 'Topic ID' },
          name: { type: 'string', description: 'New topic name' },
        },
        required: ['courseId', 'topicId', 'name'],
      },
    },
    {
      name: 'delete_topic',
      description: 'Delete a topic from a course',
      inputSchema: {
        type: 'object',
        properties: {
          courseId: { type: 'string', description: 'Course ID' },
          topicId: { type: 'string', description: 'Topic ID' },
        },
        required: ['courseId', 'topicId'],
      },
    },

    // ── Invitations ────────────────────────────────────────────────────────
    {
      name: 'list_invitations',
      description: 'List pending course invitations',
      inputSchema: {
        type: 'object',
        properties: {
          courseId: { type: 'string', description: 'Filter by course' },
          userId: { type: 'string', description: 'Filter by user' },
          role: { type: 'string', description: 'Filter by role: STUDENT, TEACHER' },
          pageSize: { type: 'number' },
          pageToken: { type: 'string' },
        },
      },
    },
    {
      name: 'create_invitation',
      description: 'Invite a user (student or teacher) to a course',
      inputSchema: {
        type: 'object',
        properties: {
          courseId: { type: 'string', description: 'Course ID' },
          userId: { type: 'string', description: 'Email or userId of invitee' },
          role: { type: 'string', description: 'STUDENT or TEACHER' },
        },
        required: ['courseId', 'userId', 'role'],
      },
    },
    {
      name: 'accept_invitation',
      description: 'Accept a course invitation',
      inputSchema: {
        type: 'object',
        properties: {
          invitationId: { type: 'string', description: 'Invitation ID' },
        },
        required: ['invitationId'],
      },
    },
    {
      name: 'delete_invitation',
      description: 'Delete or revoke a course invitation',
      inputSchema: {
        type: 'object',
        properties: {
          invitationId: { type: 'string', description: 'Invitation ID' },
        },
        required: ['invitationId'],
      },
    },

    // ── Roster Management ──────────────────────────────────────────────────
    {
      name: 'list_students',
      description: 'List students enrolled in a course',
      inputSchema: {
        type: 'object',
        properties: {
          courseId: { type: 'string', description: 'Course ID' },
          pageSize: { type: 'number' },
          pageToken: { type: 'string' },
        },
        required: ['courseId'],
      },
    },
    {
      name: 'enroll_student',
      description: 'Enroll a student in a course by email or userId',
      inputSchema: {
        type: 'object',
        properties: {
          courseId: { type: 'string', description: 'Course ID' },
          userId: { type: 'string', description: 'Student email or userId' },
        },
        required: ['courseId', 'userId'],
      },
    },
    {
      name: 'remove_student',
      description: 'Remove/unenroll a student from a course',
      inputSchema: {
        type: 'object',
        properties: {
          courseId: { type: 'string', description: 'Course ID' },
          userId: { type: 'string', description: 'Student userId' },
        },
        required: ['courseId', 'userId'],
      },
    },
    {
      name: 'list_teachers',
      description: 'List teachers in a course',
      inputSchema: {
        type: 'object',
        properties: {
          courseId: { type: 'string', description: 'Course ID' },
          pageSize: { type: 'number' },
          pageToken: { type: 'string' },
        },
        required: ['courseId'],
      },
    },
    {
      name: 'add_teacher',
      description: 'Add a teacher to a course by email or userId',
      inputSchema: {
        type: 'object',
        properties: {
          courseId: { type: 'string', description: 'Course ID' },
          userId: { type: 'string', description: 'Teacher email or userId' },
        },
        required: ['courseId', 'userId'],
      },
    },
    {
      name: 'remove_teacher',
      description: 'Remove a teacher from a course',
      inputSchema: {
        type: 'object',
        properties: {
          courseId: { type: 'string', description: 'Course ID' },
          userId: { type: 'string', description: 'Teacher userId' },
        },
        required: ['courseId', 'userId'],
      },
    },

    // ── Course Materials ───────────────────────────────────────────────────
    {
      name: 'list_course_materials',
      description: 'List materials posted to a course',
      inputSchema: {
        type: 'object',
        properties: {
          courseId: { type: 'string', description: 'Course ID' },
          pageSize: { type: 'number' },
          pageToken: { type: 'string' },
        },
        required: ['courseId'],
      },
    },
    {
      name: 'get_course_material',
      description: 'Get a specific course material',
      inputSchema: {
        type: 'object',
        properties: {
          courseId: { type: 'string', description: 'Course ID' },
          materialId: { type: 'string', description: 'Material ID (same as courseworkId)' },
        },
        required: ['courseId', 'materialId'],
      },
    },

    // ── Guardians ──────────────────────────────────────────────────────────
    {
      name: 'list_guardians',
      description: 'List guardian relationships for a student',
      inputSchema: {
        type: 'object',
        properties: {
          studentId: { type: 'string', description: 'Student userId (use "me" for self)' },
          pageSize: { type: 'number' },
          pageToken: { type: 'string' },
        },
        required: ['studentId'],
      },
    },
    {
      name: 'get_guardian',
      description: 'Get details of a specific guardian relationship',
      inputSchema: {
        type: 'object',
        properties: {
          studentId: { type: 'string', description: 'Student userId' },
          guardianId: { type: 'string', description: 'Guardian profile ID' },
        },
        required: ['studentId', 'guardianId'],
      },
    },
    {
      name: 'create_guardian',
      description: 'Create a guardian invitation or link',
      inputSchema: {
        type: 'object',
        properties: {
          courseId: { type: 'string', description: 'Course ID (required)' },
          studentId: { type: 'string', description: 'Student userId' },
          guardianEmail: { type: 'string', description: 'Guardian email address' },
        },
        required: ['courseId', 'studentId', 'guardianEmail'],
      },
    },
    {
      name: 'delete_guardian',
      description: 'Remove a guardian relationship',
      inputSchema: {
        type: 'object',
        properties: {
          studentId: { type: 'string', description: 'Student userId' },
          guardianId: { type: 'string', description: 'Guardian profile ID' },
        },
        required: ['studentId', 'guardianId'],
      },
    },
  ];
}

export async function executeTool(name: string, args: any, oauth2Client: any): Promise<any> {
  const classroom = google.classroom({ version: 'v1', auth: oauth2Client });

  switch (name) {
    // ── Course Management ──────────────────────────────────────────────────
    case 'list_courses': {
      const params: any = {};
      if (args.teacherId) params.teacherId = args.teacherId;
      if (args.studentId) params.studentId = args.studentId;
      if (args.courseState) params.courseState = args.courseState;
      if (args.pageSize) params.pageSize = args.pageSize;
      if (args.pageToken) params.pageToken = args.pageToken;
      const res = await classroom.courses.list(params);
      return ok(res.data);
    }

    case 'get_course': {
      if (!args.courseId) throw new McpError(ErrorCode.InvalidParams, 'courseId is required');
      const res = await classroom.courses.get({ id: args.courseId });
      return ok(res.data);
    }

    case 'create_course': {
      if (!args.name) throw new McpError(ErrorCode.InvalidParams, 'name is required');
      const course: any = { name: args.name };
      if (args.section) course.section = args.section;
      if (args.description) course.description = args.description;
      if (args.room) course.room = args.room;
      if (args.ownerId) course.ownerId = args.ownerId;
      const res = await classroom.courses.create({ requestBody: course });
      return ok(res.data);
    }

    case 'update_course': {
      if (!args.courseId) throw new McpError(ErrorCode.InvalidParams, 'courseId is required');
      const updateMask: string[] = [];
      const course: any = {};
      if (args.name !== undefined) { course.name = args.name; updateMask.push('name'); }
      if (args.section !== undefined) { course.section = args.section; updateMask.push('section'); }
      if (args.description !== undefined) { course.description = args.description; updateMask.push('description'); }
      if (args.room !== undefined) { course.room = args.room; updateMask.push('room'); }
      if (updateMask.length === 0) throw new McpError(ErrorCode.InvalidParams, 'At least one field to update is required');
      const res = await classroom.courses.patch({
        id: args.courseId,
        updateMask: updateMask.join(','),
        requestBody: course,
      });
      return ok(res.data);
    }

    case 'delete_course': {
      if (!args.courseId) throw new McpError(ErrorCode.InvalidParams, 'courseId is required');
      // The Classroom API does not support deleting courses directly.
      // Archive the course instead (sets courseState to ARCHIVED).
      try {
        const res = await classroom.courses.patch({
          id: args.courseId,
          updateMask: 'courseState',
          requestBody: { courseState: 'ARCHIVED' },
        });
        return ok({ success: true, message: `Course ${args.courseId} archived (API does not support deletion)`, course: res.data });
      } catch (err: any) {
        // If archiving fails, try to delete directly (works for courses in DRAFT/PROVISIONED state)
        try {
          await classroom.courses.delete({ id: args.courseId });
          return ok({ success: true, message: `Course ${args.courseId} deleted` });
        } catch (delErr: any) {
          throw new McpError(ErrorCode.InternalError, `Cannot delete or archive course ${args.courseId}: ${err.message || delErr.message}`);
        }
      }
    }

    case 'update_course_state': {
      if (!args.courseId) throw new McpError(ErrorCode.InvalidParams, 'courseId is required');
      if (!args.courseState) throw new McpError(ErrorCode.InvalidParams, 'courseState is required');
      const validStates = ['ACTIVE', 'ARCHIVED', 'PROVISIONED'];
      if (!validStates.includes(args.courseState)) {
        throw new McpError(ErrorCode.InvalidParams, `Invalid courseState: ${args.courseState}. Must be one of: ${validStates.join(', ')}`);
      }
      const res = await classroom.courses.patch({
        id: args.courseId,
        updateMask: 'courseState',
        requestBody: { courseState: args.courseState },
      });
      return ok(res.data);
    }

    // ── Announcements ──────────────────────────────────────────────────────
    case 'list_announcements': {
      if (!args.courseId) throw new McpError(ErrorCode.InvalidParams, 'courseId is required');
      const params: any = { courseId: args.courseId };
      if (args.pageSize) params.pageSize = args.pageSize;
      if (args.pageToken) params.pageToken = args.pageToken;
      if (args.orderBy) params.orderBy = args.orderBy;
      const res = await classroom.courses.announcements.list(params);
      return ok(res.data);
    }

    case 'get_announcement': {
      if (!args.courseId) throw new McpError(ErrorCode.InvalidParams, 'courseId is required');
      if (!args.announcementId) throw new McpError(ErrorCode.InvalidParams, 'announcementId is required');
      const res = await classroom.courses.announcements.get({
        courseId: args.courseId,
        id: args.announcementId,
      });
      return ok(res.data);
    }

    case 'create_announcement': {
      if (!args.courseId) throw new McpError(ErrorCode.InvalidParams, 'courseId is required');
      if (!args.text) throw new McpError(ErrorCode.InvalidParams, 'text is required');
      const announcement: any = { text: args.text };
      if (args.materials) announcement.materials = args.materials;
      if (args.state) announcement.state = args.state;
      if (args.announceToAllStudents === false && args.individualStudentIds) {
        announcement.assigneeMode = 'INDIVIDUAL_STUDENTS';
        announcement.individualStudentsOptions = {
          studentIds: args.individualStudentIds,
        };
      } else {
        announcement.assigneeMode = 'ALL_STUDENTS';
      }
      const res = await classroom.courses.announcements.create({
        courseId: args.courseId,
        requestBody: announcement,
      });
      return ok(res.data);
    }

    case 'update_announcement': {
      if (!args.courseId) throw new McpError(ErrorCode.InvalidParams, 'courseId is required');
      if (!args.announcementId) throw new McpError(ErrorCode.InvalidParams, 'announcementId is required');
      const updateMask: string[] = [];
      const announcement: any = {};
      if (args.text !== undefined) { announcement.text = args.text; updateMask.push('text'); }
      if (args.materials !== undefined) { announcement.materials = args.materials; updateMask.push('materials'); }
      if (args.state !== undefined) { announcement.state = args.state; updateMask.push('state'); }
      if (updateMask.length === 0) throw new McpError(ErrorCode.InvalidParams, 'At least one field to update is required');
      const res = await classroom.courses.announcements.patch({
        courseId: args.courseId,
        id: args.announcementId,
        updateMask: updateMask.join(','),
        requestBody: announcement,
      });
      return ok(res.data);
    }

    case 'delete_announcement': {
      if (!args.courseId) throw new McpError(ErrorCode.InvalidParams, 'courseId is required');
      if (!args.announcementId) throw new McpError(ErrorCode.InvalidParams, 'announcementId is required');
      await classroom.courses.announcements.delete({
        courseId: args.courseId,
        id: args.announcementId,
      });
      return ok({ success: true, message: `Announcement ${args.announcementId} deleted` });
    }

    // ── Course Work ────────────────────────────────────────────────────────
    case 'list_coursework': {
      if (!args.courseId) throw new McpError(ErrorCode.InvalidParams, 'courseId is required');
      const params: any = { courseId: args.courseId };
      if (args.pageSize) params.pageSize = args.pageSize;
      if (args.pageToken) params.pageToken = args.pageToken;
      if (args.orderBy) params.orderBy = args.orderBy;
      const res = await classroom.courses.courseWork.list(params);
      return ok(res.data);
    }

    case 'get_coursework': {
      if (!args.courseId) throw new McpError(ErrorCode.InvalidParams, 'courseId is required');
      if (!args.courseworkId) throw new McpError(ErrorCode.InvalidParams, 'courseworkId is required');
      const res = await classroom.courses.courseWork.get({
        courseId: args.courseId,
        id: args.courseworkId,
      });
      return ok(res.data);
    }

    case 'create_coursework': {
      if (!args.courseId) throw new McpError(ErrorCode.InvalidParams, 'courseId is required');
      if (!args.title) throw new McpError(ErrorCode.InvalidParams, 'title is required');
      if (!args.workType) throw new McpError(ErrorCode.InvalidParams, 'workType is required');
      const validWorkTypes = ['ASSIGNMENT', 'MULTIPLE_CHOICE_QUESTION', 'SHORT_ANSWER_QUESTION', 'MATERIAL'];
      if (!validWorkTypes.includes(args.workType)) {
        throw new McpError(ErrorCode.InvalidParams, `Invalid workType: ${args.workType}. Must be one of: ${validWorkTypes.join(', ')}`);
      }

      const coursework: any = {
        title: args.title,
        workType: args.workType,
      };
      if (args.description) coursework.description = args.description;
      if (args.materials) coursework.materials = args.materials;
      if (args.state) coursework.state = args.state;
      if (args.maxPoints !== undefined) coursework.maxPoints = args.maxPoints;
      if (args.submissionModificationMode) coursework.submissionModificationMode = args.submissionModificationMode;

      if (args.dueDate) {
        coursework.dueDate = {
          year: args.dueDate.year,
          month: args.dueDate.month,
          day: args.dueDate.day,
        };
      }
      if (args.dueTime) {
        coursework.dueTime = {};
        if (args.dueTime.hours !== undefined) coursework.dueTime.hours = args.dueTime.hours;
        if (args.dueTime.minutes !== undefined) coursework.dueTime.minutes = args.dueTime.minutes;
        if (args.dueTime.seconds !== undefined) coursework.dueTime.seconds = args.dueTime.seconds;
        if (args.dueTime.nanos !== undefined) coursework.dueTime.nanos = args.dueTime.nanos;
        if (args.dueTime.timeZone) coursework.dueTime.timeZone = args.dueTime.timeZone;
      }

      if (args.assigneeMode === 'INDIVIDUAL_STUDENTS' && args.individualStudentIds) {
        coursework.assigneeMode = 'INDIVIDUAL_STUDENTS';
        coursework.individualStudentsOptions = {
          studentIds: args.individualStudentIds,
        };
      } else {
        coursework.assigneeMode = 'ALL_STUDENTS';
      }

      const res = await classroom.courses.courseWork.create({
        courseId: args.courseId,
        requestBody: coursework,
      });
      return ok(res.data);
    }

    case 'update_coursework': {
      if (!args.courseId) throw new McpError(ErrorCode.InvalidParams, 'courseId is required');
      if (!args.courseworkId) throw new McpError(ErrorCode.InvalidParams, 'courseworkId is required');
      const updateMask: string[] = [];
      const coursework: any = {};

      if (args.title !== undefined) { coursework.title = args.title; updateMask.push('title'); }
      if (args.description !== undefined) { coursework.description = args.description; updateMask.push('description'); }
      if (args.materials !== undefined) { coursework.materials = args.materials; updateMask.push('materials'); }
      if (args.state !== undefined) { coursework.state = args.state; updateMask.push('state'); }
      if (args.maxPoints !== undefined) { coursework.maxPoints = args.maxPoints; updateMask.push('maxPoints'); }

      if (args.dueDate) {
        coursework.dueDate = { year: args.dueDate.year, month: args.dueDate.month, day: args.dueDate.day };
        updateMask.push('dueDate');
      }
      if (args.dueTime) {
        coursework.dueTime = {};
        if (args.dueTime.hours !== undefined) coursework.dueTime.hours = args.dueTime.hours;
        if (args.dueTime.minutes !== undefined) coursework.dueTime.minutes = args.dueTime.minutes;
        if (args.dueTime.seconds !== undefined) coursework.dueTime.seconds = args.dueTime.seconds;
        if (args.dueTime.nanos !== undefined) coursework.dueTime.nanos = args.dueTime.nanos;
        if (args.dueTime.timeZone) coursework.dueTime.timeZone = args.dueTime.timeZone;
        updateMask.push('dueTime');
      }

      if (args.assigneeMode !== undefined) {
        coursework.assigneeMode = args.assigneeMode;
        updateMask.push('assigneeMode');
      }
      if (args.individualStudentIds !== undefined) {
        coursework.individualStudentsOptions = { studentIds: args.individualStudentIds };
        updateMask.push('individualStudentsOptions');
      }

      if (updateMask.length === 0) throw new McpError(ErrorCode.InvalidParams, 'At least one field to update is required');
      const res = await classroom.courses.courseWork.patch({
        courseId: args.courseId,
        id: args.courseworkId,
        updateMask: updateMask.join(','),
        requestBody: coursework,
      });
      return ok(res.data);
    }

    case 'delete_coursework': {
      if (!args.courseId) throw new McpError(ErrorCode.InvalidParams, 'courseId is required');
      if (!args.courseworkId) throw new McpError(ErrorCode.InvalidParams, 'courseworkId is required');
      await classroom.courses.courseWork.delete({
        courseId: args.courseId,
        id: args.courseworkId,
      });
      return ok({ success: true, message: `CourseWork ${args.courseworkId} deleted` });
    }

    // ── Student Submissions ────────────────────────────────────────────────
    case 'list_student_submissions': {
      if (!args.courseId) throw new McpError(ErrorCode.InvalidParams, 'courseId is required');
      if (!args.courseworkId) throw new McpError(ErrorCode.InvalidParams, 'courseworkId is required');
      const params: any = {
        courseId: args.courseId,
        courseWorkId: args.courseworkId,
      };
      if (args.userId) params.userId = args.userId;
      if (args.late) params.late = args.late;
      if (args.submissionState) params.submissionState = args.submissionState;
      if (args.pageSize) params.pageSize = args.pageSize;
      if (args.pageToken) params.pageToken = args.pageToken;
      const res = await classroom.courses.courseWork.studentSubmissions.list(params);
      return ok(res.data);
    }

    case 'get_student_submission': {
      if (!args.courseId) throw new McpError(ErrorCode.InvalidParams, 'courseId is required');
      if (!args.courseworkId) throw new McpError(ErrorCode.InvalidParams, 'courseworkId is required');
      if (!args.submissionId) throw new McpError(ErrorCode.InvalidParams, 'submissionId is required');
      const res = await classroom.courses.courseWork.studentSubmissions.get({
        courseId: args.courseId,
        courseWorkId: args.courseworkId,
        id: args.submissionId,
      });
      return ok(res.data);
    }

    case 'submit_student_submission': {
      if (!args.courseId) throw new McpError(ErrorCode.InvalidParams, 'courseId is required');
      if (!args.courseworkId) throw new McpError(ErrorCode.InvalidParams, 'courseworkId is required');
      if (!args.submissionId) throw new McpError(ErrorCode.InvalidParams, 'submissionId is required');
      const res = await classroom.courses.courseWork.studentSubmissions.turnIn({
        courseId: args.courseId,
        courseWorkId: args.courseworkId,
        id: args.submissionId,
        requestBody: {},
      });
      return ok(res.data);
    }

    case 'unsubmit_student_submission': {
      if (!args.courseId) throw new McpError(ErrorCode.InvalidParams, 'courseId is required');
      if (!args.courseworkId) throw new McpError(ErrorCode.InvalidParams, 'courseworkId is required');
      if (!args.submissionId) throw new McpError(ErrorCode.InvalidParams, 'submissionId is required');
      const res = await classroom.courses.courseWork.studentSubmissions.patch({
        courseId: args.courseId,
        courseWorkId: args.courseworkId,
        id: args.submissionId,
        updateMask: 'state',
        requestBody: { state: 'NEW' },
      });
      return ok(res.data);
    }

    case 'add_student_submission_attachment': {
      if (!args.courseId) throw new McpError(ErrorCode.InvalidParams, 'courseId is required');
      if (!args.courseworkId) throw new McpError(ErrorCode.InvalidParams, 'courseworkId is required');
      if (!args.submissionId) throw new McpError(ErrorCode.InvalidParams, 'submissionId is required');

      const attachment: any = {};
      if (args.driveFile) {
        attachment.driveFile = { id: args.driveFile.id, title: args.driveFile.title };
      } else if (args.youTubeVideo) {
        attachment.youTubeVideo = {
          id: args.youTubeVideo.id,
          title: args.youTubeVideo.title,
          alternateLink: args.youTubeVideo.alternateLink,
        };
      } else if (args.link) {
        attachment.link = { url: args.link.url, title: args.link.title };
      } else if (args.form) {
        attachment.form = { formUrl: args.form.formUrl, responseUrl: args.form.responseUrl };
      } else {
        throw new McpError(ErrorCode.InvalidParams, 'At least one attachment type (driveFile, youTubeVideo, link, form) is required');
      }

      const res = await classroom.courses.courseWork.studentSubmissions.modifyAttachments({
        courseId: args.courseId,
        courseWorkId: args.courseworkId,
        id: args.submissionId,
        requestBody: {
          addAttachments: [attachment],
        },
      });
      return ok(res.data);
    }

    case 'modify_attachments': {
      if (!args.courseId) throw new McpError(ErrorCode.InvalidParams, 'courseId is required');
      if (!args.courseworkId) throw new McpError(ErrorCode.InvalidParams, 'courseworkId is required');
      if (!args.submissionId) throw new McpError(ErrorCode.InvalidParams, 'submissionId is required');

      const requestBody: any = {};
      if (args.addAttachments) requestBody.addAttachments = args.addAttachments;
      if (args.removeAttachmentIds) requestBody.removeAttachmentIds = args.removeAttachmentIds;
      if (!requestBody.addAttachments && !requestBody.removeAttachmentIds) {
        throw new McpError(ErrorCode.InvalidParams, 'At least one of addAttachments or removeAttachmentIds is required');
      }

      const res = await classroom.courses.courseWork.studentSubmissions.modifyAttachments({
        courseId: args.courseId,
        courseWorkId: args.courseworkId,
        id: args.submissionId,
        requestBody,
      });
      return ok(res.data);
    }

    case 'return_student_submission': {
      if (!args.courseId) throw new McpError(ErrorCode.InvalidParams, 'courseId is required');
      if (!args.courseworkId) throw new McpError(ErrorCode.InvalidParams, 'courseworkId is required');
      if (!args.submissionId) throw new McpError(ErrorCode.InvalidParams, 'submissionId is required');
      const requestBody: any = {};
      if (args.draftGrade !== undefined) requestBody.draftGrade = args.draftGrade;
      if (args.assignedGrade !== undefined) requestBody.assignedGrade = args.assignedGrade;
      const res = await classroom.courses.courseWork.studentSubmissions.return({
        courseId: args.courseId,
        courseWorkId: args.courseworkId,
        id: args.submissionId,
        requestBody,
      });
      return ok(res.data);
    }

    case 'reclaim_student_submission': {
      if (!args.courseId) throw new McpError(ErrorCode.InvalidParams, 'courseId is required');
      if (!args.courseworkId) throw new McpError(ErrorCode.InvalidParams, 'courseworkId is required');
      if (!args.submissionId) throw new McpError(ErrorCode.InvalidParams, 'submissionId is required');
      const res = await classroom.courses.courseWork.studentSubmissions.reclaim({
        courseId: args.courseId,
        courseWorkId: args.courseworkId,
        id: args.submissionId,
        requestBody: {},
      });
      return ok(res.data);
    }

    // ── Grades ─────────────────────────────────────────────────────────────
    case 'grade_student_submission': {
      if (!args.courseId) throw new McpError(ErrorCode.InvalidParams, 'courseId is required');
      if (!args.courseworkId) throw new McpError(ErrorCode.InvalidParams, 'courseworkId is required');
      if (!args.submissionId) throw new McpError(ErrorCode.InvalidParams, 'submissionId is required');
      if (args.assignedGrade === undefined) throw new McpError(ErrorCode.InvalidParams, 'assignedGrade is required');
      const patchBody: any = {
        assignedGrade: args.assignedGrade,
      };
      if (args.draftGrade !== undefined) {
        patchBody.draftGrade = args.draftGrade;
      }
      const updateMask = args.draftGrade !== undefined ? 'assignedGrade,draftGrade' : 'assignedGrade';
      const res = await classroom.courses.courseWork.studentSubmissions.patch({
        courseId: args.courseId,
        courseWorkId: args.courseworkId,
        id: args.submissionId,
        updateMask,
        requestBody: patchBody,
      });
      return ok(res.data);
    }

    // ── Topics ─────────────────────────────────────────────────────────────
    case 'list_topics': {
      if (!args.courseId) throw new McpError(ErrorCode.InvalidParams, 'courseId is required');
      const params: any = { courseId: args.courseId };
      if (args.pageSize) params.pageSize = args.pageSize;
      if (args.pageToken) params.pageToken = args.pageToken;
      const res = await classroom.courses.topics.list(params);
      return ok(res.data);
    }

    case 'create_topic': {
      if (!args.courseId) throw new McpError(ErrorCode.InvalidParams, 'courseId is required');
      if (!args.name) throw new McpError(ErrorCode.InvalidParams, 'name is required');
      const res = await classroom.courses.topics.create({
        courseId: args.courseId,
        requestBody: { name: args.name },
      });
      return ok(res.data);
    }

    case 'update_topic': {
      if (!args.courseId) throw new McpError(ErrorCode.InvalidParams, 'courseId is required');
      if (!args.topicId) throw new McpError(ErrorCode.InvalidParams, 'topicId is required');
      if (!args.name) throw new McpError(ErrorCode.InvalidParams, 'name is required');
      const res = await classroom.courses.topics.patch({
        courseId: args.courseId,
        id: args.topicId,
        updateMask: 'name',
        requestBody: { name: args.name },
      });
      return ok(res.data);
    }

    case 'delete_topic': {
      if (!args.courseId) throw new McpError(ErrorCode.InvalidParams, 'courseId is required');
      if (!args.topicId) throw new McpError(ErrorCode.InvalidParams, 'topicId is required');
      await classroom.courses.topics.delete({
        courseId: args.courseId,
        id: args.topicId,
      });
      return ok({ success: true, message: `Topic ${args.topicId} deleted` });
    }

    // ── Invitations ────────────────────────────────────────────────────────
    case 'list_invitations': {
      const params: any = {};
      if (args.courseId) params.courseId = args.courseId;
      if (args.userId) params.userId = args.userId;
      if (args.role) params.role = args.role;
      if (args.pageSize) params.pageSize = args.pageSize;
      if (args.pageToken) params.pageToken = args.pageToken;
      const res = await classroom.invitations.list(params);
      return ok(res.data);
    }

    case 'create_invitation': {
      if (!args.courseId) throw new McpError(ErrorCode.InvalidParams, 'courseId is required');
      if (!args.userId) throw new McpError(ErrorCode.InvalidParams, 'userId is required');
      if (!args.role) throw new McpError(ErrorCode.InvalidParams, 'role is required');
      const validRoles = ['STUDENT', 'TEACHER'];
      if (!validRoles.includes(args.role)) {
        throw new McpError(ErrorCode.InvalidParams, `Invalid role: ${args.role}. Must be one of: ${validRoles.join(', ')}`);
      }
      const res = await classroom.invitations.create({
        requestBody: {
          courseId: args.courseId,
          userId: args.userId,
          role: args.role,
        },
      });
      return ok(res.data);
    }

    case 'accept_invitation': {
      if (!args.invitationId) throw new McpError(ErrorCode.InvalidParams, 'invitationId is required');
      try {
        const res = await classroom.invitations.accept({ id: args.invitationId });
        return ok(res.data);
      } catch (err: any) {
        if (err?.code === 404 || err?.message?.includes('not found')) {
          throw new McpError(ErrorCode.InvalidParams, `Invitation ${args.invitationId} not found or already processed. Use list_invitations to see valid invitation IDs.`);
        }
        throw err;
      }
    }

    case 'delete_invitation': {
      if (!args.invitationId) throw new McpError(ErrorCode.InvalidParams, 'invitationId is required');
      try {
        await classroom.invitations.delete({ id: args.invitationId });
        return ok({ success: true, message: `Invitation ${args.invitationId} deleted` });
      } catch (err: any) {
        if (err?.code === 404 || err?.message?.includes('not found')) {
          throw new McpError(ErrorCode.InvalidParams, `Invitation ${args.invitationId} not found or already processed.`);
        }
        throw err;
      }
    }

    // ── Roster Management ──────────────────────────────────────────────────
    case 'list_students': {
      if (!args.courseId) throw new McpError(ErrorCode.InvalidParams, 'courseId is required');
      const params: any = { courseId: args.courseId };
      if (args.pageSize) params.pageSize = args.pageSize;
      if (args.pageToken) params.pageToken = args.pageToken;
      const res = await classroom.courses.students.list(params);
      return ok(res.data);
    }

    case 'enroll_student': {
      if (!args.courseId) throw new McpError(ErrorCode.InvalidParams, 'courseId is required');
      if (!args.userId) throw new McpError(ErrorCode.InvalidParams, 'userId is required');
      const res = await classroom.courses.students.create({
        courseId: args.courseId,
        requestBody: { userId: args.userId },
      });
      return ok(res.data);
    }

    case 'remove_student': {
      if (!args.courseId) throw new McpError(ErrorCode.InvalidParams, 'courseId is required');
      if (!args.userId) throw new McpError(ErrorCode.InvalidParams, 'userId is required');
      await classroom.courses.students.delete({
        courseId: args.courseId,
        userId: args.userId,
      });
      return ok({ success: true, message: `Student ${args.userId} removed from course ${args.courseId}` });
    }

    case 'list_teachers': {
      if (!args.courseId) throw new McpError(ErrorCode.InvalidParams, 'courseId is required');
      const params: any = { courseId: args.courseId };
      if (args.pageSize) params.pageSize = args.pageSize;
      if (args.pageToken) params.pageToken = args.pageToken;
      const res = await classroom.courses.teachers.list(params);
      return ok(res.data);
    }

    case 'add_teacher': {
      if (!args.courseId) throw new McpError(ErrorCode.InvalidParams, 'courseId is required');
      if (!args.userId) throw new McpError(ErrorCode.InvalidParams, 'userId is required');
      const res = await classroom.courses.teachers.create({
        courseId: args.courseId,
        requestBody: { userId: args.userId },
      });
      return ok(res.data);
    }

    case 'remove_teacher': {
      if (!args.courseId) throw new McpError(ErrorCode.InvalidParams, 'courseId is required');
      if (!args.userId) throw new McpError(ErrorCode.InvalidParams, 'userId is required');
      await classroom.courses.teachers.delete({
        courseId: args.courseId,
        userId: args.userId,
      });
      return ok({ success: true, message: `Teacher ${args.userId} removed from course ${args.courseId}` });
    }

    // ── Course Materials ───────────────────────────────────────────────────
    case 'list_course_materials': {
      if (!args.courseId) throw new McpError(ErrorCode.InvalidParams, 'courseId is required');
      const params: any = {
        courseId: args.courseId,
      };
      if (args.pageSize) params.pageSize = args.pageSize;
      if (args.pageToken) params.pageToken = args.pageToken;
      const res = await classroom.courses.courseWork.list(params);
      const materials = (res.data.courseWork || []).filter(
        (item: any) => item.workType === 'MATERIAL'
      );
      return ok({ courseWork: materials, nextPageToken: res.data.nextPageToken });
    }

    case 'get_course_material': {
      if (!args.courseId) throw new McpError(ErrorCode.InvalidParams, 'courseId is required');
      if (!args.materialId) throw new McpError(ErrorCode.InvalidParams, 'materialId is required');
      const res = await classroom.courses.courseWork.get({
        courseId: args.courseId,
        id: args.materialId,
      });
      if (res.data.workType !== 'MATERIAL') {
        return ok({ ...res.data, note: 'This courseWork item is not of type MATERIAL', warning: true });
      }
      return ok(res.data);
    }

    // ── Guardians ──────────────────────────────────────────────────────────
    case 'list_guardians': {
      if (!args.studentId) throw new McpError(ErrorCode.InvalidParams, 'studentId is required');
      const params: any = {
        studentId: args.studentId,
      };
      if (args.pageSize) params.pageSize = args.pageSize;
      if (args.pageToken) params.pageToken = args.pageToken;
      const res = await classroom.userProfiles.guardianInvitations.list(params);
      return ok(res.data);
    }

    case 'get_guardian': {
      if (!args.studentId) throw new McpError(ErrorCode.InvalidParams, 'studentId is required');
      if (!args.guardianId) throw new McpError(ErrorCode.InvalidParams, 'guardianId is required');
      const res = await classroom.userProfiles.guardianInvitations.get({
        studentId: args.studentId,
        invitationId: args.guardianId,
      });
      return ok(res.data);
    }

    case 'create_guardian': {
      if (!args.studentId) throw new McpError(ErrorCode.InvalidParams, 'studentId is required');
      if (!args.guardianEmail) throw new McpError(ErrorCode.InvalidParams, 'guardianEmail is required');
      const invitationBody: any = {
        invitedEmailAddress: args.guardianEmail,
      };
      if (args.courseId) invitationBody.courseId = args.courseId;
      const res = await classroom.userProfiles.guardianInvitations.create({
        studentId: args.studentId,
        requestBody: invitationBody,
      });
      return ok(res.data);
    }

    case 'delete_guardian': {
      if (!args.studentId) throw new McpError(ErrorCode.InvalidParams, 'studentId is required');
      if (!args.guardianId) throw new McpError(ErrorCode.InvalidParams, 'guardianId is required');
      await classroom.userProfiles.guardians.delete({
        guardianId: args.guardianId,
        studentId: args.studentId,
      });
      return ok({ success: true, message: `Guardian ${args.guardianId} removed for student ${args.studentId}` });
    }

    default:
      throw new McpError(ErrorCode.InvalidParams, `Unknown tool: ${name}`);
  }
}
