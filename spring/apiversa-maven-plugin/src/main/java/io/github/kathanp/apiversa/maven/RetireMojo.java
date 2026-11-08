package io.github.kathanp.apiversa.maven;

import java.io.File;
import org.apache.maven.plugin.AbstractMojo;
import org.apache.maven.plugin.MojoFailureException;
import org.apache.maven.plugins.annotations.Mojo;
import org.apache.maven.plugins.annotations.Parameter;

/** Removes one date unless it has recent traffic, is head, or is the only date. */
@Mojo(name = "retire", requiresProject = true)
public class RetireMojo extends AbstractMojo {
    @Parameter(property = "apiversa.dir", defaultValue = "${project.basedir}/src/main/resources/api-versions")
    private File dir;

    @Parameter(property = "apiversa.date", required = true)
    private String date;

    @Parameter(property = "apiversa.force", defaultValue = "false")
    private boolean force;

    @Override
    public void execute() throws MojoFailureException {
        try {
            for (String removed : Retire.retire(dir.toPath(), date, force)) getLog().info("removed " + removed);
        } catch (Exception exception) {
            throw new MojoFailureException(exception.getMessage(), exception);
        }
    }
}
