"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const IdentityService_1 = require("../services/IdentityService");
const CourseService_1 = require("../services/CourseService");
const AcademicService_1 = require("../services/AcademicService");
const GraduationService_1 = require("../services/GraduationService");
const CertificateService_1 = require("../services/CertificateService");
const router = (0, express_1.Router)();
function toPlain(obj) {
    if (obj === null || obj === undefined)
        return obj;
    if (typeof obj === 'bigint')
        return obj.toString();
    if (typeof obj !== 'object')
        return obj;
    if (Array.isArray(obj)) {
        const keys = Object.keys(obj).filter((k) => isNaN(Number(k)));
        if (keys.length > 0) {
            const plain = {};
            for (const key of keys) {
                plain[key] = toPlain(obj[key]);
            }
            return plain;
        }
        return obj.map(toPlain);
    }
    const plain = {};
    for (const key of Object.keys(obj)) {
        plain[key] = toPlain(obj[key]);
    }
    return plain;
}
// ============ IDENTITY (READ-ONLY) ============
router.get('/identity/isAdmin/:address', async (req, res) => {
    try {
        const result = await IdentityService_1.identityService.isAdmin(req.params.address);
        res.json({ address: req.params.address, isAdmin: result });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.get('/identity/isInstitution/:address', async (req, res) => {
    try {
        const result = await IdentityService_1.identityService.isInstitution(req.params.address);
        res.json({ address: req.params.address, isInstitution: result });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.get('/identity/userExists/:address', async (req, res) => {
    try {
        const result = await IdentityService_1.identityService.userExists(req.params.address);
        res.json({ address: req.params.address, exists: result });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.get('/identity/getUserRole/:address', async (req, res) => {
    try {
        const result = await IdentityService_1.identityService.getUserRole(req.params.address);
        res.json({ address: req.params.address, role: Number(result) });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.get('/identity/getStudentData/:address', async (req, res) => {
    try {
        const data = await IdentityService_1.identityService.getStudentData(req.params.address);
        res.json(toPlain(data));
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.get('/identity/getInstitutionData/:address', async (req, res) => {
    try {
        const data = await IdentityService_1.identityService.getInstitutionData(req.params.address);
        res.json(toPlain(data));
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.get('/identity/getAllInstitutions', async (_req, res) => {
    try {
        const data = await IdentityService_1.identityService.getAllInstitutions();
        res.json(toPlain(data));
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.get('/identity/getAllAdmins', async (_req, res) => {
    try {
        const data = await IdentityService_1.identityService.getAllAdmins();
        res.json(toPlain(data));
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// ============ COURSE (READ-ONLY) ============
router.get('/course/isDepartmentExist/:name', async (req, res) => {
    try {
        const result = await CourseService_1.courseService.isDepartmentExist(req.params.name);
        res.json({ department: req.params.name, exists: result });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.get('/course/getAllDepartments', async (_req, res) => {
    try {
        const data = await CourseService_1.courseService.getAllDepartments();
        res.json(toPlain(data));
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.get('/course/getCourseStaticDetails/:courseId', async (req, res) => {
    try {
        const data = await CourseService_1.courseService.getCourseStaticDetails(req.params.courseId);
        res.json({
            courseId: data.courseId,
            name: data.name,
            credits: data.credits.toString(),
            department: data.department,
            isActive: data.isActive,
            creationDate: data.creationDate.toString(),
        });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.get('/course/courseExists/:courseId', async (req, res) => {
    try {
        const exists = await CourseService_1.courseService.courseExists(req.params.courseId);
        res.json({ courseId: req.params.courseId, exists });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// ============ ACADEMIC (READ-ONLY) ============
router.get('/academic/getStudentEnrollment/:studentAddress/:courseId/:semester', async (req, res) => {
    try {
        const data = await AcademicService_1.academicService.getStudentEnrollment(req.params.studentAddress, req.params.courseId, req.params.semester);
        res.json(toPlain(data));
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.get('/academic/getStudentGpa/:studentAddress', async (req, res) => {
    try {
        const gpa = await AcademicService_1.academicService.getStudentGpa(req.params.studentAddress);
        res.json({ studentAddress: req.params.studentAddress, gpa: gpa.toString() });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.get('/academic/getStudentTotalCredits/:studentAddress', async (req, res) => {
    try {
        const credits = await AcademicService_1.academicService.getStudentTotalCredits(req.params.studentAddress);
        res.json({ studentAddress: req.params.studentAddress, totalCredits: credits.toString() });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.get('/academic/getStudentEnrolledCourses/:studentAddress', async (req, res) => {
    try {
        const courses = await AcademicService_1.academicService.getStudentEnrolledCourses(req.params.studentAddress);
        res.json({ studentAddress: req.params.studentAddress, courses: toPlain(courses) });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// ============ GRADUATION (READ-ONLY) ============
router.get('/graduation/getGraduationStatus/:studentAddress', async (req, res) => {
    try {
        const status = await GraduationService_1.graduationService.getGraduationStatus(req.params.studentAddress);
        res.json({ studentAddress: req.params.studentAddress, status: Number(status) });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// ============ CERTIFICATE (READ-ONLY) ============
router.get('/certificate/verifyCertificate/:certificateId', async (req, res) => {
    try {
        const result = await CertificateService_1.certificateService.verifyCertificate(req.params.certificateId);
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
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.default = router;
//# sourceMappingURL=admin.js.map