export const validate = (schema) => (req, res, next) => {
    // 1. Safety check
    if (!schema) {
        console.error("🔥 Validation Middleware Error: Schema is undefined.");
        return res.status(500).json({ error: 'Internal server error during validation' });
    }

    // 2. Safe parse
    const result = schema.safeParse(req.body);

    // 3. Handle failure safely
    if (!result.success) {
        // Safely extract issues, with a fallback if Zod's structure changes
        const errorDetails = result.error?.issues 
            ? result.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`)
            : ["Invalid input data provided"];

        return res.status(400).json({ 
            error: 'Validation failed', 
            details: errorDetails 
        });
    }

    // 4. Success: Attach clean data and continue
    req.body = result.data;
    next();
};