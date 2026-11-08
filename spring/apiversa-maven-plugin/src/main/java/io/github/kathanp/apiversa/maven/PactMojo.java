package io.github.kathanp.apiversa.maven;

import java.io.File;
import org.apache.maven.plugin.AbstractMojo;
import org.apache.maven.plugin.MojoFailureException;
import org.apache.maven.plugins.annotations.Mojo;
import org.apache.maven.plugins.annotations.Parameter;

/** Upgrade pact requests and downgrade pact responses. */
@Mojo(name = "pact", requiresProject = true)
public class PactMojo extends AbstractMojo {
    @Parameter(property = "apiversa.dir", defaultValue = "${project.basedir}/src/main/resources/api-versions")
    private File dir;

    @Parameter(property = "in")
    private File input;

    @Parameter(property = "out")
    private File out;

    @Override
    public void execute() throws MojoFailureException {
        if (input == null || out == null) return;
        try {
            Pact.write(dir.toPath(), input.toPath(), out.toPath());
        } catch (Exception exception) {
            throw new MojoFailureException(exception.getMessage(), exception);
        }
    }
}
