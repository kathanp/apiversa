package io.github.kathanp.apiversa.maven;

import java.io.File;
import java.util.List;
import org.apache.maven.plugin.AbstractMojo;
import org.apache.maven.plugin.MojoFailureException;
import org.apache.maven.plugins.annotations.Mojo;
import org.apache.maven.plugins.annotations.Parameter;

/** Prints each bundle problem and its fix. A problem fails the build. */
@Mojo(name = "doctor", requiresProject = true)
public class DoctorMojo extends AbstractMojo {
    @Parameter(property = "apiversa.dir", defaultValue = "${project.basedir}/src/main/resources/api-versions")
    private File dir;

    @Override
    public void execute() throws MojoFailureException {
        try {
            List<Doctor.Problem> problems = Doctor.doctor(dir.toPath());
            if (problems.isEmpty()) {
                getLog().info("apiversa doctor: no problems");
                return;
            }
            StringBuilder text = new StringBuilder();
            for (Doctor.Problem problem : problems) text.append(problem.message()).append("\n  fix: ").append(problem.fix()).append('\n');
            throw new MojoFailureException(text.toString());
        } catch (MojoFailureException exception) {
            throw exception;
        } catch (Exception exception) {
            throw new MojoFailureException(exception.getMessage(), exception);
        }
    }
}
