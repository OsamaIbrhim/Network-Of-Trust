import { Router, Request, Response } from 'express';
import { identityService } from '../services/IdentityService';
import { courseService } from '../services/CourseService';
import { academicService } from '../services/AcademicService';
import { graduationService } from '../services/GraduationService';
import { certificateService } from '../services/CertificateService';

const router = Router();

function toPlain(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'bigint') return obj.toString();
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    const keys = Object.keys(obj).filter((k) => isNaN(Number(k)));
    if (keys.length > 0) {
      const plain: Record<string, any> = {};
      for (const key of keys) {
        plain[key] = toPlain((obj as any)[key]);
      }
      return plain;
    }
    return obj.map(toPlain);
  }
  const plain: Record<string, any> = {};
  for (const key of Object.keys(obj)) {
    plain[key] = toPlain(obj[key]);
  }
  return plain;
}

// ============ IDENTITY (READ-ONLY) ============

router.get('/identity/isAdmin/:address', async (req: Request, res: Response) => {
  try {
    const result = await identityService.isAdmin(req.params.address);
    res.json({ address: req.params.address, isAdmin: result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/identity/isInstitution/:address', async (req: Request, res: Response) => {
  try {
    const result = await identityService.isInstitution(req.params.address);
    res.json({ address: req.params.address, isInstitution: result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/identity/userExists/:address', async (req: Request, res: Response) => {
  try {
    const result = await identityService.userExists(req.params.address);
    res.json({ address: req.params.address, exists: result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/identity/getUserRole/:address', async (req: Request, res: Response) => {
  try {
    const result = await identityService.getUserRole(req.params.address);
    res.json({ address: req.params.address, role: Number(result) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/identity/getStudentData/:address', async (req: Request, res: Response) => {
  try {
    const data = await identityService.getStudentData(req.params.address);
    res.json(toPlain(data));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/identity/getInstitutionData/:address', async (req: Request, res: Response) => {
  try {
    const data = await identityService.getInstitutionData(req.params.address);
    res.json(toPlain(data));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/identity/getAllInstitutions', async (_req: Request, res: Response) => {
  try {
    const data = await identityService.getAllInstitutions();
    res.json(toPlain(data));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/identity/getAllAdmins', async (_req: Request, res: Response) => {
  try {
    const data = await identityService.getAllAdmins();
    res.json(toPlain(data));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ============ COURSE (READ-ONLY) ============

router.get('/course/isDepartmentExist/:name', async (req: Request, res: Response) => {
  try {
    const result = await courseService.isDepartmentExist(req.params.name);
    res.json({ department: req.params.name, exists: result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/course/getAllDepartments', async (_req: Request, res: Response) => {
  try {
    const data = await courseService.getAllDepartments();
    res.json(toPlain(data));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/course/getCourseStaticDetails/:courseId', async (req: Request, res: Response) => {
  try {
    const data = await courseService.getCourseStaticDetails(req.params.courseId);
    res.json({
      courseId: data.courseId,
      name: data.name,
      credits: data.credits.toString(),
      department: data.department,
      isActive: data.isActive,
      creationDate: data.creationDate.toString(),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/course/courseExists/:courseId', async (req: Request, res: Response) => {
  try {
    const exists = await courseService.courseExists(req.params.courseId);
    res.json({ courseId: req.params.courseId, exists });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ============ ACADEMIC (READ-ONLY) ============

router.get('/academic/getStudentEnrollment/:studentAddress/:courseId/:semester', async (req: Request, res: Response) => {
  try {
    const data = await academicService.getStudentEnrollment(
      req.params.studentAddress, req.params.courseId, req.params.semester
    );
    res.json(toPlain(data));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/academic/getStudentGpa/:studentAddress', async (req: Request, res: Response) => {
  try {
    const gpa = await academicService.getStudentGpa(req.params.studentAddress);
    res.json({ studentAddress: req.params.studentAddress, gpa: gpa.toString() });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/academic/getStudentTotalCredits/:studentAddress', async (req: Request, res: Response) => {
  try {
    const credits = await academicService.getStudentTotalCredits(req.params.studentAddress);
    res.json({ studentAddress: req.params.studentAddress, totalCredits: credits.toString() });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/academic/getStudentEnrolledCourses/:studentAddress', async (req: Request, res: Response) => {
  try {
    const courses = await academicService.getStudentEnrolledCourses(req.params.studentAddress);
    res.json({ studentAddress: req.params.studentAddress, courses: toPlain(courses) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ============ GRADUATION (READ-ONLY) ============

router.get('/graduation/getGraduationStatus/:studentAddress', async (req: Request, res: Response) => {
  try {
    const status = await graduationService.getGraduationStatus(req.params.studentAddress);
    res.json({ studentAddress: req.params.studentAddress, status: Number(status) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ============ CERTIFICATE (READ-ONLY) ============

router.get('/certificate/verifyCertificate/:certificateId', async (req: Request, res: Response) => {
  try {
    const result = await certificateService.verifyCertificate(req.params.certificateId);
    const student = result.student ?? result[0];
    const institution = result.institution ?? result[1];
    const ipfsHash = result.ipfsHash ?? result[2];
    const issuedAt = result.issuedAt ?? result[3];
    const isValid = result.isValid ?? result[4];
    res.json({
      student,
      institution,
      ipfsHash,
      issuedAt: issuedAt?.toString?.() ?? issuedAt,
      isValid,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
